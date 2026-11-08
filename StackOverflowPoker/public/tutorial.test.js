const fs = require("fs");
const path = require("path");
const vm = require("vm");

// BT-02: Test tutorial navigation
const html = fs.readFileSync(
    path.join(__dirname, "tutorial.html"),
    "utf8"
);

const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

let elements;

beforeEach(function() {
    elements = {};

    const ids = [
        "stepNumber",
        "stepTitle",
        "stepText",
        "previousButton",
        "nextButton"
    ];

    for (const id of ids) {
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
    }

    const document = {
        getElementById: function(id) {
            return elements[id];
        }
    };

    vm.runInNewContext(script, { document });
});

test("BT-02: Tutorial starts on step one", function() {
    expect(elements.stepNumber.textContent).toBe("Step 1 of 6");
    expect(elements.stepTitle.textContent).toBe("Join a Table");
});

test("BT-02: Previous is disabled on first step", function() {
    expect(elements.previousButton.disabled).toBe(true);
});

test("BT-02: Next button moves forward", function() {
    elements.nextButton.click();

    expect(elements.stepNumber.textContent).toBe("Step 2 of 6");
    expect(elements.stepTitle.textContent).toBe("Start the Game");
});

test("BT-02: Previous button moves backward", function() {
    elements.nextButton.click();
    elements.previousButton.click();

    expect(elements.stepNumber.textContent).toBe("Step 1 of 6");
});

test("BT-02: Previous is enabled after first step", function() {
    elements.nextButton.click();

    expect(elements.previousButton.disabled).toBe(false);
});

test("BT-02: Last step shows Restart", function() {
    for (let i = 0; i < 5; i++) {
        elements.nextButton.click();
    }

    expect(elements.stepTitle.textContent).toBe("Win the Hand");
    expect(elements.nextButton.textContent).toBe("Restart");
});

test("BT-02: Restart returns to first step", function() {
    for (let i = 0; i < 6; i++) {
        elements.nextButton.click();
    }

    expect(elements.stepNumber.textContent).toBe("Step 1 of 6");
    expect(elements.nextButton.textContent).toBe("Next");
});

test("BT-02: Tutorial includes poker hand rankings", function() {
    expect(html).toContain("Royal Flush");
    expect(html).toContain("Full House");
    expect(html).toContain("High Card");
});
