/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("patient_wellness_activities");
  collection.indexes.push("CREATE INDEX idx_patient_wellness_activities_userId ON patient_wellness_activities (userId)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("patient_wellness_activities");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_patient_wellness_activities_userId"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})