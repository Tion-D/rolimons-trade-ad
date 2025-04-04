/*
Made by @spiderphobias on discord. (Noor)
June 25, 2024
Made for auto posting rolimons trade ad with a smart algorithm. This is smarter and way better then any other bot. 
Open source and completely free. THIS IS NOT TO ABUSE THE SITE ROLIMONS.COM! 
Please don't spam unrealistic trades lowering the trade quality, it doesnt help you or other users!
*/

var app = require("express")(); // For hosting the API and uptime monitoring
app.use(require("body-parser").json());

const dotenv = require("dotenv"); // Used for safely loading secrets from environment variables
dotenv.config();

const fetch = require("node-fetch");

const rolimonsToken = process.env.token; // ROLIMONS verification token from environment
const robloxId = process.env.robloxId; // Roblox ID from environment
const config = require("./config.json"); // Configuration file

let itemValues = {}; // Format: "itemId": {"value": number, "type": number}
let playerInv = {}; // Player's current inventory
let onHold = []; // Items on hold

// Get item values from ROLIMONS, including demand and value
async function getValues() {
  await fetch(`https://api.rolimons.com/items/v1/itemdetails`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((json) => {
      for (const item in json.items) {
        let type = json.items[item][5] >= 0 ? json.items[item][5] : 0;
        itemValues[item] = { value: Math.abs(json.items[item][4]), type: type };
      }
      // After getting the item values, fetch the inventory.
      getInv();
    })
    .catch((err) => {
      console.log(err);
    });
}

// Get the player's inventory and items on hold
async function getInv() {
  await fetch(`https://api.rolimons.com/players/v1/playerassets/${robloxId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  })
    .then((res) => res.json())
    .then((json) => {
      playerInv = json.playerAssets;
      onHold = json.holds;
      generateAd();
    })
    .catch((err) => {
      console.log(err);
    });
}

// Find valid pairs of items whose combined value is within a specified range
function findValidPairs(items, min, max) {
  const validPairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sum = items[i].value + items[j].value;
      if (sum > min && sum < max) {
        validPairs.push([items[i], items[j]]);
      }
    }
  }
  return validPairs;
}

// Generate a trade ad based on available inventory and configured parameters
function generateAd() {
  let availableItems = [];
  // Loop through the player's inventory. Check that itemValues exists for the asset.
  for (const asset in playerInv) {
    if (!itemValues[asset]) continue; // Skip if itemValues for this asset is undefined
    for (const uaid of playerInv[asset]) {
      if (
        !onHold.includes(uaid) &&
        itemValues[asset].value >= config.minItemValue &&
        config.maxItemValue >= itemValues[asset].value &&
        !config.sendBlacklist.includes(`${asset}`)
      ) {
        availableItems.push(asset);
      }
    }
  }

  if (availableItems.length === 0) {
    console.log("No available items found.");
    return;
  }

  // Determine how many items to send
  let sendingSideNum =
    Math.floor(
      Math.random() * (config.maxItemsSend - config.minItemsSend + 1)
    ) + config.minItemsSend;
  let sendingSide = [];
  for (let i = 0; i < sendingSideNum && availableItems.length > 0; i++) {
    let randomIndex = Math.floor(Math.random() * availableItems.length);
    let item = availableItems[randomIndex];
    sendingSide.push(parseFloat(item));
    availableItems.splice(randomIndex, 1);
  }

  if (config.smartAlgo) {
    let receivingSide = [];
    let totalSendValue = 0;
    for (const item of sendingSide) {
      if (itemValues[item]) {
        totalSendValue += itemValues[item].value;
      }
    }
    let upgOrDown = Math.floor(Math.random() * 2);
    if (upgOrDown === 1) {
      let requestValue = totalSendValue * (1 - config.RequestPercent / 100);
      let options = [];
      for (const item in itemValues) {
        if (
          itemValues[item].value >= requestValue &&
          itemValues[item].value <= totalSendValue &&
          itemValues[item].type >= config.minDemand &&
          !sendingSide.includes(parseFloat(item))
        ) {
          options.push(item);
        }
      }

      if (options.length >= 1) {
        let selectedItem =
          options[Math.floor(Math.random() * options.length)];
        receivingSide.push(parseFloat(selectedItem));
        receivingSide.push("upgrade");
        receivingSide.push("adds");
        postAd(sendingSide, receivingSide);
      } else {
        receivingSide.push("adds");
        let itemIdValArr = [];
        for (const item in itemValues) {
          if (itemValues[item].type >= config.minDemand) {
            itemIdValArr.push({ id: item, value: itemValues[item].value });
          }
        }
        let validPairs = findValidPairs(
          itemIdValArr,
          totalSendValue * (1 - config.RequestPercent / 100),
          totalSendValue
        );
        if (validPairs.length > 0) {
          const randomPair =
            validPairs[Math.floor(Math.random() * validPairs.length)];
          const ids = randomPair.map((item) => item.id);
          for (const id of ids) {
            receivingSide.push(parseFloat(id));
          }
          let maxRValue = 0;
          let maxSValue = 0;
          for (const item of receivingSide) {
            if (typeof item === "number" && itemValues[item]) {
              if (parseFloat(itemValues[item].value) > maxRValue) {
                maxRValue = itemValues[item].value;
              }
            }
          }
          for (const item of sendingSide) {
            if (typeof item === "number" && itemValues[item]) {
              if (parseFloat(itemValues[item].value) > maxSValue) {
                maxSValue = itemValues[item].value;
              }
            }
          }
          if (maxSValue < maxRValue) {
            receivingSide.push("upgrade");
          } else {
            receivingSide.push("downgrade");
          }
          postAd(sendingSide, receivingSide);
        } else {
          console.log("No valid pairs found.");
          generateAd();
        }
      }
    } else {
      let receivingSide = [];
      receivingSide.push("adds");
      let itemIdValArr = [];
      for (const item in itemValues) {
        if (itemValues[item].type >= config.minDemand) {
          itemIdValArr.push({ id: item, value: itemValues[item].value });
        }
      }
      let validPairs = findValidPairs(
        itemIdValArr,
        totalSendValue * (1 - config.RequestPercent / 100),
        totalSendValue
      );
      if (validPairs.length > 0) {
        const randomPair =
          validPairs[Math.floor(Math.random() * validPairs.length)];
        const ids = randomPair.map((item) => item.id);
        for (const id of ids) {
          receivingSide.push(parseFloat(id));
        }
        let maxRValue = 0;
        let maxSValue = 0;
        for (const item of receivingSide) {
          if (typeof item === "number" && itemValues[item]) {
            if (parseFloat(itemValues[item].value) > maxRValue) {
              maxRValue = itemValues[item].value;
            }
          }
        }
        for (const item of sendingSide) {
          if (typeof item === "number" && itemValues[item]) {
            if (parseFloat(itemValues[item].value) > maxSValue) {
              maxSValue = itemValues[item].value;
            }
          }
        }
        if (maxSValue < maxRValue) {
          receivingSide.push("upgrade");
        } else {
          receivingSide.push("downgrade");
        }
        postAd(sendingSide, receivingSide);
      } else {
        console.log("No valid pairs found.");
        generateAd();
      }
    }
  } else {
    // Manual item selection can be added soon
  }
}

// Post the trade ad to ROLIMONS
async function postAd(sending, receiving) {
  let allRTags = [];
  let allRIds = [];

  console.log("Giving:", sending, "requesting", receiving);
  for (const tag of receiving) {
    if (typeof tag === "string") {
      allRTags.push(tag);
    } else if (typeof tag === "number") {
      allRIds.push(tag);
    }
  }

  let seenStrings = new Set();
  const result = allRTags.filter((item) => {
    if (typeof item === "string") {
      if (seenStrings.has(item)) {
        return false;
      }
      seenStrings.add(item);
    }
    return true;
  });

  let reqBody = {
    player_id: parseFloat(robloxId),
    offer_item_ids: sending,
    request_item_ids: allRIds,
    request_tags: result,
  };

  console.log(reqBody);

  fetch("https://api.rolimons.com/tradeads/v1/createad", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "cookie": `_RoliVerification=${rolimonsToken}`
    }, // <-- Note the comma here!
    body: JSON.stringify(reqBody)
  })
  .then(res => res.json())
  .then(json => {
    console.log(json);
  })
  .catch(err => {
    console.log(err);
  });

  setTimeout(function () {
    getValues();
  }, 1560000); // Timeout in milliseconds (26 minutes)
}

getValues(); // Start the process

app.get("/", (req, res) => {
  res.json({ message: "Trade ad bot is up and running!" });
});
app.listen(8080);
