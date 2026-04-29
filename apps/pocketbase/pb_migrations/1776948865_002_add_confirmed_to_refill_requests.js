/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("refill_requests");

  const existing = collection.fields.getByName("confirmed");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("confirmed"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "confirmed",
    values: ["pending", "confirmed", "ready", "shipped", "delivered"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("refill_requests");
    collection.fields.removeByName("confirmed");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})