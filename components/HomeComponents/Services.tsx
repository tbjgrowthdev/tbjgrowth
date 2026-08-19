import { getServices } from "@/app/(admin)/actions/services";
import ServicesClient from "./ServicesClient";

export default async function Services() {
  const dbServices = await getServices();
  return <ServicesClient dbServices={dbServices} />;
}