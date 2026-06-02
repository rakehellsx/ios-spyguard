CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`udid` varchar(64) NOT NULL,
	`name` text,
	`model` text,
	`productType` varchar(64),
	`iosVersion` varchar(32),
	`buildVersion` varchar(32),
	`serialNumber` varchar(64),
	`status` enum('connected','disconnected','unknown') NOT NULL DEFAULT 'unknown',
	`lastSeen` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`addedBy` int,
	CONSTRAINT `devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `devices_udid_unique` UNIQUE(`udid`)
);
--> statement-breakpoint
CREATE TABLE `ioc_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`fileKey` text NOT NULL,
	`fileUrl` text NOT NULL,
	`fileSize` bigint,
	`format` varchar(32) DEFAULT 'stix2',
	`indicatorCount` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ioc_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `local_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(256) NOT NULL,
	`displayName` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `local_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_accounts_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `scan_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`objectType` varchar(64) NOT NULL,
	`indicatorType` varchar(64) NOT NULL,
	`value` text,
	`path` text,
	`matchedText` text,
	`severity` enum('critical','high','medium','low','informational') NOT NULL DEFAULT 'medium',
	`confidence` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`description` text,
	`source` enum('ioc','heuristic') NOT NULL DEFAULT 'heuristic',
	`matchedIndicator` text,
	`isDetected` boolean NOT NULL DEFAULT false,
	`timestamp` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scan_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scan_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`deviceId` int,
	`deviceUdid` varchar(64),
	`scanType` enum('encrypted_backup','filesystem_dump','sysdiagnose') NOT NULL,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`progress` int DEFAULT 0,
	`progressMessage` text,
	`dataPath` text,
	`dataFileKey` text,
	`iocFileIds` json DEFAULT ('[]'),
	`resultSummary` json,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scan_tasks_id` PRIMARY KEY(`id`)
);
