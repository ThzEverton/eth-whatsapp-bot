import { userJid } from "../utils/normalize.js";
export class PermissionService {
  constructor(private owner: string | (() => string | undefined)) {}
  isOwner(authenticatedSender: string) {
    const owner = userJid(
      typeof this.owner === "function" ? this.owner() : this.owner,
    );
    return !!owner && userJid(authenticatedSender) === owner;
  }
}
