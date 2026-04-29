/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("patients");

  const existing = collection.fields.getByName("preferred_language");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("preferred_language"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "preferred_language",
    required: false,
    values: ["English", "Spanish", "French", "Mandarin", "Hindi", "Other"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("patients");
    collection.fields.removeByName("preferred_language");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})