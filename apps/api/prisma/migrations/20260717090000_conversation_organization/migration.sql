ALTER TABLE `Conversation`
  ADD COLUMN `isFavorite` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Conversation_isArchived_isFavorite_updatedAt_idx`
  ON `Conversation`(`isArchived`, `isFavorite`, `updatedAt`);
