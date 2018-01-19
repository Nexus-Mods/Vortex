import { Buffer } from "nbind/dist/shim";

export class NBindBase { free?(): void }

export class File extends NBindBase {
	/** std::string name; -- Read-only */
	name: string;

	/** std::string displayName; -- Read-only */
	displayName: string;
}

export class Location extends NBindBase {
	/** std::string URL; -- Read-only */
	URL: string;

	/** std::string name; -- Read-only */
	name: string;
}

export class Loot extends NBindBase {
	/** Loot(std::string, std::string, std::string); */
	constructor(p0: string, p1: string, p2: string);

	/** void updateMasterlist(std::string, std::string, std::string, cbFunction &); */
	updateMasterlist(masterlistPath: string, repoUrl: string, repoBranch: string, callback: (err: Error, didUpdate: boolean) => any): void;

	/** MasterlistInfo getMasterlistRevision(std::string, bool); */
	getMasterlistRevision(masterlistPath: string, getShortId: boolean): MasterlistInfo;

	/** void loadLists(std::string, std::string, cbFunction &); */
	loadLists(masterlistPath: string, userlistPath: string, callback: (...args: any[]) => any): void;

	/** PluginMetadata getPluginMetadata(std::string); */
	getPluginMetadata(pluginName: string): PluginMetadata;

	/** void sortPlugins(std::vector<std::string>, cbFunction &); */
	sortPlugins(pluginNames: string[], callback: (...args: any[]) => any): void;
}

export class MasterlistInfo extends NBindBase {
	/** std::string revisionId; -- Read-only */
	revisionId: string;

	/** std::string revisionDate; -- Read-only */
	revisionDate: string;

	/** bool isModified; -- Read-only */
	isModified: boolean;
}

export class Message extends NBindBase {
	/** std::string value(const std::string &); */
	value(language: string): string;

	/** uint32_t type; -- Read-only */
	type: number;
}

export class MessageContent extends NBindBase {
	/** std::string text; -- Read-only */
	text: string;

	/** std::string language; -- Read-only */
	language: string;
}

export class PluginCleaningData extends NBindBase {
	/** uint32_t CRC; -- Read-only */
	CRC: number;

	/** uint32_t ITMCount; -- Read-only */
	ITMCount: number;

	/** uint32_t deletedReferenceCount; -- Read-only */
	deletedReferenceCount: number;

	/** uint32_t deletedNavmeshCount; -- Read-only */
	deletedNavmeshCount: number;

	/** std::string cleaningUtility; -- Read-only */
	cleaningUtility: string;

	/** std::vector<MessageContent> info; -- Read-only */
	info: MessageContent[];
}

export class PluginMetadata extends NBindBase {
	/** std::vector<Message> messages; -- Read-only */
	messages: Message[];

	/** std::string name; -- Read-only */
	name: string;

	/** std::vector<Tag> tags; -- Read-only */
	tags: Tag[];

	/** std::vector<PluginCleaningData> cleanInfo; -- Read-only */
	cleanInfo: PluginCleaningData[];

	/** std::vector<PluginCleaningData> dirtyInfo; -- Read-only */
	dirtyInfo: PluginCleaningData[];

	/** Priority globalPriority; -- Read-only */
	globalPriority: Priority;

	/** std::vector<File> incompatibilities; -- Read-only */
	incompatibilities: File[];

	/** std::vector<File> loadAfterFiles; -- Read-only */
	loadAfterFiles: File[];

	/** Priority localPriority; -- Read-only */
	localPriority: Priority;

	/** std::vector<Location> locations; -- Read-only */
	locations: Location[];

	/** std::vector<File> requirements; -- Read-only */
	requirements: File[];

	/** bool IsEnabled; -- Read-only */
	IsEnabled: boolean;
}

export class Priority extends NBindBase {
	/** int16_t value; -- Read-only */
	value: number;

	/** bool IsExplicit; -- Read-only */
	IsExplicit: boolean;
}

export class Tag extends NBindBase {
	/** bool IsAddition; -- Read-only */
	IsAddition: boolean;

	/** std::string name; -- Read-only */
	name: string;
}

/** bool IsCompatible(uint32_t, uint32_t, uint32_t); */
export function IsCompatible(major: number, minor: number, patch: number): boolean;
