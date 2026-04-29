/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("health_profile");

  const existing = collection.fields.getByName("pregnancy_status");
  if (existing) {
    if (existing.type === "bool") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("pregnancy_status"); // exists with wrong type, remove first
  }

  collection.fields.add(new BoolField({
    name: "pregnancy_status",
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("health_profile");
    collection.fields.removeByName("pregnancy_status");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})