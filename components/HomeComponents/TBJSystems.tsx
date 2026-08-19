import { getSystems } from "@/app/(admin)/actions/systems";
import TBJSystemsClient from "./TBJSystemsClient";

export default async function TBJSystems() {
  const dbSystems = await getSystems();
  return <TBJSystemsClient dbSystems={dbSystems} />;
}