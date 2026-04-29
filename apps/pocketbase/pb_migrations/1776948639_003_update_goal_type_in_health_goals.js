/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("health_goals");
  const field = collection.fields.getByName("goal_type");
  field.values = ["weight_loss", "blood_pressure", "exercise", "nutrition", "medication_adherence", "diet", "stress_management"];
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("health_goals");
  const field = collection.fields.getByName("goal_type");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["weight_loss", "blood_pressure", "exercise", "nutrition", "other"];
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})