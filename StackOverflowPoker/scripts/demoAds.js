
 // AV-01 / AV-02: Temporary advertisements for the live demo.
 // Add:    node scripts/demoAds.js add
 // Remove: node scripts/demoAds.js remove

 const path = require("path");
 require("dotenv").config({
     path: path.join(__dirname, "..", ".env")
 });

 const mongoose = require("mongoose");
 require("../dao/AdsDaoMongoose");

 const Ad = mongoose.model("Ad");

 // Create an advertisement image without needing extra files.
 function makeBanner(title, subtitle, color1, color2) {
     const svg = `
     <svg xmlns="http://www.w3.org/2000/svg"
          width="900" height="300" viewBox="0 0 900 300">

         <defs>
             <linearGradient id="bg">
                 <stop offset="0%" stop-color="${color1}"/>
                 <stop offset="100%" stop-color="${color2}"/>
             </linearGradient>
         </defs>

         <rect width="900" height="300"
               rx="20" fill="url(#bg)"/>

         <circle cx="800" cy="70" r="140"
                 fill="white" opacity="0.08"/>

         <text x="40" y="60" fill="white"
               font-size="22" font-family="Arial">
             STACK OVERFLOW POKER
         </text>

         <text x="40" y="150" fill="white"
               font-size="48" font-weight="bold"
               font-family="Arial">
             ${title}
         </text>

         <text x="40" y="210" fill="white"
               font-size="27" font-family="Arial">
             ${subtitle}
         </text>

         <text x="40" y="265" fill="white"
               font-size="17" font-family="Arial">
             SAMPLE ADVERTISEMENT - CS482 DEMO
         </text>
     </svg>`;

     return "data:image/svg+xml;charset=utf-8," +
         encodeURIComponent(svg);
 }

 // Four advertisements for the professor's demonstration.
 const demoAds = [
     {
         name: "CS482 DEMO - Learn Poker",
         imageUrl: makeBanner(
             "Learn Seven-Card Stud",
             "Discover the basics of poker",
             "#642994",
             "#C154C0"
         ),
         linkUrl: "https://en.wikipedia.org/wiki/Seven-card_stud",
         placement: "lobby",
         intervalMinutes: 1,
         active: true
     },
     {
         name: "CS482 DEMO - Challenge Bots",
         imageUrl: makeBanner(
             "Challenge the Bots",
             "Practice your poker skills",
             "#075E49",
             "#12AB83"
         ),
         linkUrl: "https://en.wikipedia.org/wiki/Poker",
         placement: "lobby",
         intervalMinutes: 1,
         active: true
     },
     {
         name: "CS482 DEMO - Poker Moves",
         imageUrl: makeBanner(
             "Know Your Poker Moves",
             "Check, Call, Raise or Fold",
             "#991C45",
             "#E55F86"
         ),
         linkUrl: "https://en.wikipedia.org/wiki/Poker",
         placement: "table",
         intervalMinutes: 1,
         active: true
     },
     {
         name: "CS482 DEMO - Play Friends",
         imageUrl: makeBanner(
             "Play With Friends",
             "Join a table and have fun",
             "#1B3D8B",
             "#4C7DDF"
         ),
         linkUrl: "https://en.wikipedia.org/wiki/Seven-card_stud",
         placement: "table",
         intervalMinutes: 1,
         active: true
     }
 ];

 async function main() {
     const command = process.argv[2];

     if (command !== "add" && command !== "remove") {
         console.log("Use: node scripts/demoAds.js add");
         console.log("Or:  node scripts/demoAds.js remove");
         return;
     }

     if (!process.env.DB_URI) {
         console.log("Missing DB_URI in .env");
         return;
     }

     try {
         await mongoose.connect(process.env.DB_URI);

         console.log("Connected to MongoDB");

         if (command === "add") {
             for (const ad of demoAds) {
                 // Do not add the same advertisement twice.
                 const existing = await Ad.findOne({
                     name: ad.name,
                     placement: ad.placement
                 });

                 if (existing) {
                     console.log("Already exists:", ad.name);
                 } else {
                     await Ad.create(ad);
                     console.log("Added:", ad.name);
                 }
             }

             console.log("Demo ads are ready!");
         }

         if (command === "remove") {
             // Only delete the demo ads created by this file.
             const filters = demoAds.map(ad => ({
                 name: ad.name,
                 placement: ad.placement,
                 imageUrl: ad.imageUrl
             }));

             const result = await Ad.deleteMany({
                 $or: filters
             });

             console.log(
                 "Removed",
                 result.deletedCount,
                 "demo advertisements."
             );
         }

     } catch (error) {
         console.error("Error:", error.message);
     } finally {
         await mongoose.disconnect();
     }
 }

 main();
