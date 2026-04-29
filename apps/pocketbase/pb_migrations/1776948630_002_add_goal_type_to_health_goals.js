/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("health_goals");

  const existing = collection.fields.getByName("goal_type");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("goal_type"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "goal_type",
    values: ["weight_loss", "blood_pressure", "exercise", "nutrition", "medication_adherence", "diet", "stress_management"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("health_goals");
    collection.fields.removeByName("goal_type");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})