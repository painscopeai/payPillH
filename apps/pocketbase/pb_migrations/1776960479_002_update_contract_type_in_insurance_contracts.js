/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("insurance_contracts");
  const field = collection.fields.getByName("contract_type");
  field.values = ["PPO", "HMO", "HDHP", "POS", "Other"];
  field.required = true;
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("insurance_contracts");
  const field = collection.fields.getByName("contract_type");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["employer", "individual", "provider"];
  field.required = false;
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})