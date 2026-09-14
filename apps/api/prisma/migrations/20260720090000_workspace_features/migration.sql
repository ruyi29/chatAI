ALTER TABLE `Conversation` ADD COLUMN `groupId` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `passwordHash` VARCHAR(255) NULL;
ALTER TABLE `Message`
  ADD COLUMN `parentMessageId` VARCHAR(191) NULL,
  ADD COLUMN `variantIndex` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `ConversationGroup` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT '#167b6f',
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ConversationGroup_userId_sortOrder_idx`(`userId`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PromptTemplate` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(80) NOT NULL,
  `content` TEXT NOT NULL,
  `category` VARCHAR(40) NOT NULL DEFAULT '我的',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `PromptTemplate_userId_updatedAt_idx`(`userId`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Attachment` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `messageId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `size` INTEGER NOT NULL,
  `storagePath` VARCHAR(500) NOT NULL,
  `extractedText` LONGTEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'READY',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Attachment_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `Attachment_messageId_idx`(`messageId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserSession` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `UserSession_tokenHash_key`(`tokenHash`),
  INDEX `UserSession_userId_idx`(`userId`),
  INDEX `UserSession_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Conversation_groupId_idx` ON `Conversation`(`groupId`);
CREATE INDEX `Message_parentMessageId_variantIndex_idx` ON `Message`(`parentMessageId`, `variantIndex`);
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ConversationGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Message` ADD CONSTRAINT `Message_parentMessageId_fkey` FOREIGN KEY (`parentMessageId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ConversationGroup` ADD CONSTRAINT `ConversationGroup_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PromptTemplate` ADD CONSTRAINT `PromptTemplate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `UserSession` ADD CONSTRAINT `UserSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
