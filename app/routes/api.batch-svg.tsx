import type { ActionFunctionArgs } from "react-router";
import { action as homeAction } from "./home";

export async function action(args: ActionFunctionArgs) {
  return homeAction(args);
}
