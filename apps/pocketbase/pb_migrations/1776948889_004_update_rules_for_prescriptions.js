/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("prescriptions");
  collection.listRule = "user_id = @request.auth.id || provider_id = @request.auth.id";
  collection.viewRule = "user_id = @request.auth.id || provider_id = @request.auth.id";
  collection.createRule = "provider_id = @request.auth.id";
  collection.updateRule = "provider_id = @request.auth.id";
  collection.deleteRule = "provider_id = @request.auth.id";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("prescriptions");
  collection.listRule = "user_id = @request.auth.id || provider_id = @request.auth.id";
  collection.viewRule = "user_id = @request.auth.id || provider_id = @request.auth.id";
  collection.createRule = "provider_id = @request.auth.id";
  collection.updateRule = "provider_id = @request.auth.id";
  collection.deleteRule = "provider_id = @request.auth.id";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})