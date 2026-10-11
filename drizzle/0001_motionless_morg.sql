CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(32),
	`note` text,
	`appointmentDate` varchar(10) NOT NULL,
	`appointmentTime` varchar(5) NOT NULL,
	`activeSlotKey` varchar(16),
	`status` enum('booked','cancelled') NOT NULL DEFAULT 'booked',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`cancelledAt` timestamp,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointments_active_slot_unique` UNIQUE(`activeSlotKey`)
);
--> statement-breakpoint
CREATE INDEX `appointments_date_idx` ON `appointments` (`appointmentDate`);