/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("patients");

  const existing = collection.fields.getByName("communication_preference");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("communication_preference"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "communication_preference",
    required: false,
    values: ["Email", "SMS", "Push Notification"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("patients");
    collection.fields.removeByName("communication_preference");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})