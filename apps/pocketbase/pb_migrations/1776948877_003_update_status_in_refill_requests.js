/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("refill_requests");
  const field = collection.fields.getByName("status");
  field.values = ["pending", "confirmed", "ready", "shipped", "delivered"];
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("refill_requests");
  const field = collection.fields.getByName("status");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["pending", "ready", "shipped", "delivered"];
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})