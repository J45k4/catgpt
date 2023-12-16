-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "bot_provider" TEXT,
    "bot_model" TEXT,
    "bot_instruction" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMsg" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "char_count" INTEGER NOT NULL DEFAULT 0,
    "words_count" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "user_id" INTEGER NOT NULL,
    "chat_id" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMsg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "created_at" ON "Chat"("created_at");

-- CreateIndex
CREATE INDEX "user_id" ON "ChatMsg"("user_id");

-- CreateIndex
CREATE INDEX "chat_id" ON "ChatMsg"("chat_id");

-- CreateIndex
CREATE INDEX "timestamp" ON "ChatMsg"("timestamp");

-- CreateIndex
CREATE INDEX "user_id_timestamp" ON "ChatMsg"("user_id", "timestamp");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMsg" ADD CONSTRAINT "ChatMsg_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMsg" ADD CONSTRAINT "ChatMsg_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
