import { App } from "cdktf";
import { MultiCloudBackendStack } from "./stacks/MultiCloudBackendStack";

const app = new App();
new MultiCloudBackendStack(app, "app");
app.synth();
