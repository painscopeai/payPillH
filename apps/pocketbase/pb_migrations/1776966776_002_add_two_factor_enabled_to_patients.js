/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("patients");

  const existing = collection.fields.getByName("two_factor_enabled");
  if (existing) {
    if (existing.type === "bool") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("two_factor_enabled"); // exists with wrong type, remove first
  }

  collection.fields.add(new BoolField({
    name: "two_factor_enabled",
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("patients");
    collection.fields.removeByName("two_factor_enabled");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})