/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("prescriptions");

  const existing = collection.fields.getByName("adherence_status");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("adherence_status"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "adherence_status",
    values: ["adherent", "non_adherent", "partial"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("prescriptions");
    collection.fields.removeByName("adherence_status");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})