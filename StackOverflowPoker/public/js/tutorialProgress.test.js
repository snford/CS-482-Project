
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// BT-03: Test saved progress in the full and floating tutorials
const html = fs.readFileSync(
    path.join(__dirname, "..", "tutorial.html"),
    "utf8"
);

const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const nav = fs.readFileSync(
    path.join(__dirname, "nav.js"),
    "utf8"
);

function makeStorage() {
    const values = {};

    return {
        getItem: function(key) {
            return values[key] || null;
        },
        setItem: function(key, value) {
            values[key] = value;
        }
    };
}

function openTutorial(storage) {
    const elements = {};
    const ids = [
        "stepNumber",
        "stepTitle",
        "stepText",
        "tutorialProgress",
        "previousButton",
        "nextButton"
    ];

    ids.forEach(function(id) {
        elements[id] = {
            textContent: "",
            disabled: false,
            events: {},
            addEventListener: function(event, action) {
                this.events[event] = action;
            },
            click: function() {
                this.events.click();
            }
        };
    });

    vm.runInNewContext(script, {
        document: {
            getElementById: function(id) {
                return elements[id];
            }
        },
        localStorage: storage
    });

    return elements;
}

// Run the real save/load functions used by the floating tutorial
function openFloatingProgress(storage) {
    const start = nav.indexOf("// BT-03: Save tutorial progress");
    const end = nav.indexOf("// Fill the rankings once", start);

    if (start === -1 || end === -1) {
        throw new Error(
            "Could not find the floating tutorial progress code"
        );
    }

    return vm.runInNewContext(nav.slice(start, end) + `
        ({
            getStep: function() { return currentStep; },
            setStep: function(step) { currentStep = step; },
            load: loadTutorialProgress,
            save: saveTutorialProgress
        })`, {
        steps: new Array(6).fill({}),
        localStorage: storage
    });
}

test("BT-03: New player starts at step one", function() {
    const page = openTutorial(makeStorage());

    expect(page.stepNumber.textContent).toBe("Step 1 of 6");
});

test("BT-03: Next saves the current step", function() {
    const storage = makeStorage();
    const page = openTutorial(storage);

    page.nextButton.click();
    page.nextButton.click();

    const saved = JSON.parse(
        storage.getItem("sopTutorialProgress")
    );

    expect(saved.step).toBe(2);
    expect(saved.completed).toBe(false);
});

test("BT-03: Reopening the full tutorial resumes progress", function() {
    const storage = makeStorage();
    const first = openTutorial(storage);

    first.nextButton.click();
    first.nextButton.click();

    const reopened = openTutorial(storage);

    expect(reopened.stepNumber.textContent).toBe("Step 3 of 6");
    expect(reopened.stepTitle.textContent).toBe("Get Your First Cards");
});

test("BT-03: Previous also saves progress", function() {
    const storage = makeStorage();
    const page = openTutorial(storage);

    page.nextButton.click();
    page.previousButton.click();

    expect(
        JSON.parse(storage.getItem("sopTutorialProgress")).step
    ).toBe(0);
});

test("BT-03: Completing the tutorial is remembered", function() {
    const storage = makeStorage();
    const page = openTutorial(storage);

    for (let i = 0; i < 6; i++) {
        page.nextButton.click();
    }

    expect(
        JSON.parse(storage.getItem("sopTutorialProgress"))
    ).toEqual({
        step: 0,
        completed: true
    });

    expect(
        openTutorial(storage).tutorialProgress.textContent
    ).toContain("completed");
});

test("BT-03: Floating tutorial reads full tutorial progress", function() {
    const storage = makeStorage();
    const page = openTutorial(storage);

    page.nextButton.click();
    page.nextButton.click();

    const floating = openFloatingProgress(storage);

    expect(floating.getStep()).toBe(2);
});

test("BT-03: Full tutorial reads progress saved by floating tutorial", function() {
    const storage = makeStorage();
    const floating = openFloatingProgress(storage);

    floating.setStep(4);
    floating.save();

    expect(
        openTutorial(storage).stepNumber.textContent
    ).toBe("Step 5 of 6");
});
