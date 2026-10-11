ALTER TABLE `appointments` ADD `visitorKey` varchar(64);--> statement-breakpoint
CREATE INDEX `appointments_visitor_idx` ON `appointments` (`visitorKey`);