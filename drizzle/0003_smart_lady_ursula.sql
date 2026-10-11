ALTER TABLE `appointments` ADD `ownerOpenId` varchar(64);--> statement-breakpoint
CREATE INDEX `appointments_owner_idx` ON `appointments` (`ownerOpenId`);