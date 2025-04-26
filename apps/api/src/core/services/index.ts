import { userServices } from "./user/user.services";

export const service = {
  user: userServices
} as const;

export type Services = typeof service;

export default service;


