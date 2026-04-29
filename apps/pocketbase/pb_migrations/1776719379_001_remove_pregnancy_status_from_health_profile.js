/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("health_profile");
  collection.fields.removeByName("pregnancy_status");
  return app.save(collection);
}, (app) => {
  try {

  const collection = app.findCollectionByNameOrId("health_profile");
  collection.fields.add(new SelectField({
    name: "pregnancy_status",
    required: false,
    values: ["not_pregnant", "pregnant", "unknown"],
    maxSelect: 1
  }));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})