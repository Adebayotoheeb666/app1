"use client";

import { Client, Account, Models, ID, Databases, Storage, OAuthProvider, Permission, Role } from "appwrite";
import { User } from "./interface";

interface Sponsors {
  id: number;
  name: string;
  url: string;
}

class ServerConfig {
  client: Client = new Client();
  regDb: string = process.env.NEXT_PUBLIC_REGDB || "";
  sponDb: string = process.env.NEXT_PUBLIC_SPODB || "";
  databases: Databases = new Databases(this.client);

  constructor() {
    this.client
      .setEndpoint(process.env.NEXT_PUBLIC_ENDPOINT || "")
      .setProject(process.env.NEXT_PUBLIC_PROJECTID || "");
  }

  async createRegColl(id: string, name: string): Promise<void> {
    try {
      await this.databases.createCollection(this.regDb, id, name, [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.create(Role.any()),
        Permission.delete(Role.any()),
      ]);

      await this.databases.createStringAttribute(this.regDb, id, "name", 50, false);
      await this.databases.createStringAttribute(this.regDb, id, "email", 50, false);
      await this.databases.createStringAttribute(this.regDb, id, "confirm", 50, false, "");
    } catch (error) {
      console.error("Error creating registration collection:", error);
    }
  }

  async createSponColl(id: string, name: string, sponsors: Sponsors[], user: string): Promise<void> {
    try {
      await this.databases.createCollection(this.sponDb, id, name, [
        Permission.read(Role.any()),
        Permission.update(Role.user(user)),
        Permission.create(Role.user(user)),
        Permission.delete(Role.user(user)),
      ]);

      await this.databases.createStringAttribute(this.sponDb, id, "name", 50, false);
      await this.databases.createStringAttribute(this.sponDb, id, "url", 50, false);

      for (const sponsor of sponsors) {
        await this.databases.createDocument(this.sponDb, id, ID.unique(), {
          name: sponsor.name,
          url: sponsor.url,
        });
      }
    } catch (error) {
      console.error("Error creating sponsor collection:", error);
    }
  }
}

class AppwriteConfig {
  databaseId: string = process.env.NEXT_PUBLIC_DATABASEID || "";
  activeCollId: string = process.env.NEXT_PUBLIC_EVENT_COLLID || "";
  bannerBucketId: string = process.env.NEXT_PUBLIC_EVENTBUCKET || "";
  regDbId: string = process.env.NEXT_PUBLIC_REGDB || "";

  client: Client = new Client();
  account: Account = new Account(this.client);
  databases: Databases = new Databases(this.client);
  storage: Storage = new Storage(this.client);
  user: User = {} as User;

  constructor() {
    this.client.setEndpoint("https://cloud.appwrite.io/v1").setProject("67bc5bff000fff8525c2");
  }

  async githubLogin(): Promise<void> {
    try {
      await this.account.createOAuth2Session(
        "github",
        `${process.env.NEXT_PUBLIC_APPURL}/login/success`,
        `${process.env.NEXT_PUBLIC_APPURL}/login/failure`
      );
      await this.getCurUser();
    } catch (error) {
      console.error("GitHub login error:", error);
    }
  }

  async getCurUser(): Promise<void> {
    try {
      const user = await this.account.get();
      this.user = user;
      localStorage.setItem("userInfo", JSON.stringify(this.user));
    } catch (error) {
      console.error("Error getting current user:", error);
    }
  }

  async emailSignUp(name: string, email: string, password: string): Promise<void> {
    try {
      await this.account.create(ID.unique(), email, password, name);
    } catch (error) {
      console.error("Email sign-up error:", error);
    }
  }

  async emailLogin(email: string, password: string): Promise<Models.Session> {
    return this.account.createSession(email, password);
  }

  async signOut(id: string): Promise<boolean> {
    try {
      await this.account.deleteSession(id);
      return true;
    } catch (error) {
      console.error("Sign-out error:", error);
      return false;
    }
  }

  async magicUrlLogin(email: string): Promise<void> {
    try {
      await this.account.createMagicURLToken(
        ID.unique(),
        email,
        `${process.env.NEXT_PUBLIC_APPURL}/login/success`
      );
      await this.getCurUser();
    } catch (error) {
      console.error("Magic URL login error:", error);
    }
  }

  async createEvent(
    eventname: string,
    description: string,
    banner: File,
    hostname: string,
    eventdate: string,
    email: string,
    country: string,
    address: string,
    city: string,
    state: string,
    postal: string,
    audience: string,
    type: string,
    attendees: number,
    price: number,
    tech: string,
    agenda: string,
    sponsors: Sponsors[],
    approval: string,
    twitter: string,
    website: string,
    linkedin: string,
    instagram: string
  ): Promise<string> {
    try {
      const fileRes = await this.storage.createFile(this.bannerBucketId, ID.unique(), banner);

      const docRes = await this.databases.createDocument(this.databaseId, this.activeCollId, ID.unique(), {
        eventname,
        description,
        url: `${process.env.NEXT_PUBLIC_ENDPOINT}/storage/buckets/${this.bannerBucketId}/files/${fileRes.$id}/view?project=${process.env.NEXT_PUBLIC_PROJECTID}&mode=admin`,
        hostname,
        eventdate,
        email,
        country,
        address,
        city,
        state,
        postal,
        audience,
        type,
        attendees,
        price,
        tech,
        agenda,
        approval,
        created: JSON.parse(localStorage.getItem("userInfo") || "{}").$id,
        twitter,
        website,
        linkedin,
        instagram,
        registrations: [],
      });

      const serverConfig = new ServerConfig();
      await serverConfig.createRegColl(docRes.$id, eventname);
      await serverConfig.createSponColl(docRes.$id, eventname, sponsors, JSON.parse(localStorage.getItem("userInfo") || "{}").$id);

      return "success";
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  }
}

export { AppwriteConfig, ServerConfig };
