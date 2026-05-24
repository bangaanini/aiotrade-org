import "server-only";

import type { MemberGuideAsset, MemberGuidePost, MemberGuideSection, MemberGuideType } from "@/lib/member-guide-types";
import { validateMemberGuideInput } from "@/lib/member-guide-utils";
import { prisma } from "@/lib/prisma";

type MemberGuideAssetRecord = {
  bytes: number | null;
  createdAt: Date;
  format: string | null;
  id: string;
  label: string;
  originalFilename: string | null;
  publicId: string;
  secureUrl: string;
  storageProvider: string;
};

type MemberGuidePostRecord = {
  createdAt: Date;
  description: string;
  embedUrl: string | null;
  fileAssetId: string | null;
  fileUrl: string | null;
  id: string;
  isPaid: boolean;
  isPublished: boolean;
  price: number | null;
  publishedAt: Date;
  section: string;
  sortOrder: number;
  title: string;
  type: string;
  updatedAt: Date;
};

type SaveMemberGuideAssetInput = {
  bytes?: number | null;
  format?: string | null;
  label: string;
  originalFilename?: string | null;
  publicId: string;
  secureUrl: string;
  storageProvider?: "cloudinary" | "r2";
};

type SaveMemberGuidePostInput = {
  description: string;
  embedUrl?: string | null;
  fileAssetId?: string | null;
  fileUrl?: string | null;
  id?: string | null;
  isPaid: boolean;
  isPublished: boolean;
  price?: number | null;
  publishedAt?: string | null;
  section: MemberGuideSection;
  sortOrder: number;
  title: string;
  type: MemberGuideType;
};

function hasMemberGuideAssetDelegate() {
  return (
    "memberGuideAsset" in prisma &&
    typeof prisma.memberGuideAsset?.findMany === "function" &&
    typeof prisma.memberGuideAsset?.upsert === "function"
  );
}

function hasMemberGuidePostReadDelegate() {
  return (
    "memberGuidePost" in prisma &&
    typeof prisma.memberGuidePost?.findMany === "function" &&
    typeof prisma.memberGuidePost?.findUnique === "function"
  );
}

function hasMemberGuidePostWriteDelegate() {
  return (
    "memberGuidePost" in prisma &&
    typeof prisma.memberGuidePost?.create === "function" &&
    typeof prisma.memberGuidePost?.update === "function" &&
    typeof prisma.memberGuidePost?.delete === "function"
  );
}

function toMemberGuideAsset(asset: MemberGuideAssetRecord): MemberGuideAsset {
  return {
    bytes: asset.bytes,
    createdAt: asset.createdAt.toISOString(),
    format: asset.format,
    id: asset.id,
    label: asset.label,
    originalFilename: asset.originalFilename,
    publicId: asset.publicId,
    secureUrl: asset.secureUrl,
    storageProvider: asset.storageProvider as "cloudinary" | "r2",
  };
}

function toMemberGuidePost(post: MemberGuidePostRecord): MemberGuidePost {
  if (post.type !== "video" && post.type !== "pdf") {
    throw new Error(`Unknown member guide type: ${post.type}`);
  }

  if (post.section !== "start" && post.section !== "activation" && post.section !== "bot_settings" && post.section !== "files") {
    throw new Error(`Unknown member guide section: ${post.section}`);
  }

  return {
    createdAt: post.createdAt.toISOString(),
    description: post.description,
    embedUrl: post.embedUrl,
    fileAssetId: post.fileAssetId,
    fileUrl: post.fileUrl,
    id: post.id,
    isPaid: post.isPaid,
    isPublished: post.isPublished,
    price: post.price,
    publishedAt: post.publishedAt.toISOString(),
    section: post.section,
    sortOrder: post.sortOrder,
    title: post.title,
    type: post.type,
    updatedAt: post.updatedAt.toISOString(),
  };
}

function toDateOrNow(value: string | null | undefined) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

export async function getMemberGuideAssets() {
  const tables = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public.member_guide_assets')::text AS "tableName"
  `;

  if (!tables[0]?.tableName) {
    return [] as MemberGuideAsset[];
  }

  const records = hasMemberGuideAssetDelegate()
    ? await prisma.memberGuideAsset.findMany({
        orderBy: {
          createdAt: "desc",
        },
        select: {
          bytes: true,
          createdAt: true,
          format: true,
          id: true,
          label: true,
          originalFilename: true,
          publicId: true,
          secureUrl: true,
          storageProvider: true,
        },
      })
    : await prisma.$queryRaw<MemberGuideAssetRecord[]>`
        SELECT
          "id",
          "label",
          "public_id" AS "publicId",
          "secure_url" AS "secureUrl",
          "original_filename" AS "originalFilename",
          "bytes",
          "format",
          "storage_provider" AS "storageProvider",
          "created_at" AS "createdAt"
        FROM "public"."member_guide_assets"
        ORDER BY "created_at" DESC
      `;

  return records.map(toMemberGuideAsset);
}

export async function saveMemberGuideAsset(input: SaveMemberGuideAssetInput) {
  if (hasMemberGuideAssetDelegate()) {
    const asset = await prisma.memberGuideAsset.upsert({
      where: {
        publicId: input.publicId,
      },
      create: {
        bytes: input.bytes ?? null,
        format: input.format ?? null,
        label: input.label,
        originalFilename: input.originalFilename ?? null,
        publicId: input.publicId,
        secureUrl: input.secureUrl,
        storageProvider: input.storageProvider ?? "r2",
      },
      update: {
        bytes: input.bytes ?? null,
        format: input.format ?? null,
        label: input.label,
        originalFilename: input.originalFilename ?? null,
        secureUrl: input.secureUrl,
        storageProvider: input.storageProvider ?? "r2",
      },
      select: {
        bytes: true,
        createdAt: true,
        format: true,
        id: true,
        label: true,
        originalFilename: true,
        publicId: true,
        secureUrl: true,
        storageProvider: true,
      },
    });

    return toMemberGuideAsset(asset);
  }

  const rows = await prisma.$queryRaw<MemberGuideAssetRecord[]>`
    INSERT INTO "public"."member_guide_assets" (
      "label",
      "public_id",
      "secure_url",
      "original_filename",
      "bytes",
      "format",
      "storage_provider"
    )
    VALUES (
      ${input.label},
      ${input.publicId},
      ${input.secureUrl},
      ${input.originalFilename ?? null},
      ${input.bytes ?? null},
      ${input.format ?? null},
      ${input.storageProvider ?? "r2"}
    )
    ON CONFLICT ("public_id")
    DO UPDATE SET
      "label" = EXCLUDED."label",
      "secure_url" = EXCLUDED."secure_url",
      "original_filename" = EXCLUDED."original_filename",
      "bytes" = EXCLUDED."bytes",
      "format" = EXCLUDED."format",
      "storage_provider" = EXCLUDED."storage_provider",
      "updated_at" = CURRENT_TIMESTAMP
    RETURNING
      "id",
      "label",
      "public_id" AS "publicId",
      "secure_url" AS "secureUrl",
      "original_filename" AS "originalFilename",
      "bytes",
      "format",
      "storage_provider" AS "storageProvider",
      "created_at" AS "createdAt"
  `;

  return toMemberGuideAsset(rows[0]);
}

export async function getAdminMemberGuidePosts() {
  const tables = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public.member_guide_posts')::text AS "tableName"
  `;

  if (!tables[0]?.tableName) {
    return [] as MemberGuidePost[];
  }

  const records = hasMemberGuidePostReadDelegate()
    ? await prisma.memberGuidePost.findMany({
        orderBy: [{ updatedAt: "desc" }],
        select: {
          createdAt: true,
          description: true,
          embedUrl: true,
          fileAssetId: true,
          fileUrl: true,
          id: true,
          isPaid: true,
          isPublished: true,
          price: true,
          publishedAt: true,
          section: true,
          sortOrder: true,
          title: true,
          type: true,
          updatedAt: true,
        },
      })
    : await prisma.$queryRaw<MemberGuidePostRecord[]>`
        SELECT
          "id",
          "type",
          "title",
          "description",
          "embed_url" AS "embedUrl",
          "file_asset_id" AS "fileAssetId",
          "file_url" AS "fileUrl",
          "is_paid" AS "isPaid",
          "price",
          "sort_order" AS "sortOrder",
          "is_published" AS "isPublished",
          "published_at" AS "publishedAt",
          "section",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "public"."member_guide_posts"
        ORDER BY "updated_at" DESC
      `;

  return records.map(toMemberGuidePost);
}

export async function getPublishedMemberGuidePosts() {
  const tables = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public.member_guide_posts')::text AS "tableName"
  `;

  if (!tables[0]?.tableName) {
    return [] as MemberGuidePost[];
  }

  const records = hasMemberGuidePostReadDelegate()
    ? await prisma.memberGuidePost.findMany({
        where: {
          isPublished: true,
        },
        orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        select: {
          createdAt: true,
          description: true,
          embedUrl: true,
          fileAssetId: true,
          fileUrl: true,
          id: true,
          isPaid: true,
          isPublished: true,
          price: true,
          publishedAt: true,
          section: true,
          sortOrder: true,
          title: true,
          type: true,
          updatedAt: true,
        },
      })
    : await prisma.$queryRaw<MemberGuidePostRecord[]>`
        SELECT
          "id",
          "type",
          "title",
          "description",
          "embed_url" AS "embedUrl",
          "file_asset_id" AS "fileAssetId",
          "file_url" AS "fileUrl",
          "is_paid" AS "isPaid",
          "price",
          "sort_order" AS "sortOrder",
          "is_published" AS "isPublished",
          "published_at" AS "publishedAt",
          "section",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "public"."member_guide_posts"
        WHERE "is_published" = true
        ORDER BY "sort_order" ASC, "published_at" DESC, "created_at" DESC
      `;

  return records.map(toMemberGuidePost);
}

export async function saveMemberGuidePost(input: SaveMemberGuidePostInput) {
  const normalizedGuideInput = validateMemberGuideInput(input);

  if (input.type === "video" && !normalizedGuideInput.embedUrl) {
    throw new Error("Guide video membutuhkan URL embed yang valid.");
  }

  if (input.type === "pdf" && (!normalizedGuideInput.fileAssetId || !normalizedGuideInput.fileUrl)) {
    throw new Error("Guide PDF membutuhkan asset dan URL file yang valid.");
  }

  const payload = {
    description: input.description.trim(),
    embedUrl: normalizedGuideInput.embedUrl,
    fileAssetId: normalizedGuideInput.fileAssetId,
    fileUrl: normalizedGuideInput.fileUrl,
    isPaid: input.isPaid,
    isPublished: input.isPublished,
    price: input.isPaid ? Math.max(1000, Number(input.price ?? 0)) : null,
    publishedAt: toDateOrNow(input.publishedAt),
    section: input.section,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
    title: input.title.trim(),
    type: input.type,
  };

  if (hasMemberGuidePostWriteDelegate()) {
    const record = input.id
      ? await prisma.memberGuidePost.update({
          where: { id: input.id },
          data: payload,
          select: {
            createdAt: true,
            description: true,
            embedUrl: true,
            fileAssetId: true,
            fileUrl: true,
            id: true,
            isPaid: true,
            isPublished: true,
            price: true,
            publishedAt: true,
            section: true,
            sortOrder: true,
            title: true,
            type: true,
            updatedAt: true,
          },
        })
      : await prisma.memberGuidePost.create({
          data: payload,
          select: {
            createdAt: true,
            description: true,
            embedUrl: true,
            fileAssetId: true,
            fileUrl: true,
            id: true,
            isPaid: true,
            isPublished: true,
            price: true,
            publishedAt: true,
            section: true,
            sortOrder: true,
            title: true,
            type: true,
            updatedAt: true,
          },
        });

    return toMemberGuidePost(record as MemberGuidePostRecord);
  }

  const rows = input.id
    ? await prisma.$queryRaw<MemberGuidePostRecord[]>`
        UPDATE "public"."member_guide_posts"
        SET
          "type" = ${payload.type},
          "title" = ${payload.title},
          "description" = ${payload.description},
          "embed_url" = ${payload.embedUrl},
          "file_asset_id" = ${payload.fileAssetId},
          "file_url" = ${payload.fileUrl},
          "is_paid" = ${payload.isPaid},
          "price" = ${payload.price},
          "sort_order" = ${payload.sortOrder},
          "is_published" = ${payload.isPublished},
          "published_at" = ${payload.publishedAt},
          "section" = ${payload.section},
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.id}
        RETURNING
          "id",
          "type",
          "title",
          "description",
          "embed_url" AS "embedUrl",
          "file_asset_id" AS "fileAssetId",
          "file_url" AS "fileUrl",
          "is_paid" AS "isPaid",
          "price",
          "sort_order" AS "sortOrder",
          "is_published" AS "isPublished",
          "published_at" AS "publishedAt",
          "section",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
      `
    : await prisma.$queryRaw<MemberGuidePostRecord[]>`
        INSERT INTO "public"."member_guide_posts" (
          "type",
          "title",
          "description",
          "embed_url",
          "file_asset_id",
          "file_url",
          "is_paid",
          "price",
          "sort_order",
          "is_published",
          "published_at",
          "section"
        )
        VALUES (
          ${payload.type},
          ${payload.title},
          ${payload.description},
          ${payload.embedUrl},
          ${payload.fileAssetId},
          ${payload.fileUrl},
          ${payload.isPaid},
          ${payload.price},
          ${payload.sortOrder},
          ${payload.isPublished},
          ${payload.publishedAt},
          ${payload.section}
        )
        RETURNING
          "id",
          "type",
          "title",
          "description",
          "embed_url" AS "embedUrl",
          "file_asset_id" AS "fileAssetId",
          "file_url" AS "fileUrl",
          "is_paid" AS "isPaid",
          "price",
          "sort_order" AS "sortOrder",
          "is_published" AS "isPublished",
          "published_at" AS "publishedAt",
          "section",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
      `;

  return toMemberGuidePost(rows[0]);
}

export async function setMemberGuidePublishedState(id: string, isPublished: boolean) {
  if (hasMemberGuidePostWriteDelegate()) {
    const record = await prisma.memberGuidePost.update({
      where: { id },
      data: {
        isPublished,
      },
      select: {
        createdAt: true,
        description: true,
        embedUrl: true,
        fileAssetId: true,
        fileUrl: true,
        id: true,
        isPaid: true,
        isPublished: true,
        price: true,
        publishedAt: true,
        section: true,
        sortOrder: true,
        title: true,
        type: true,
        updatedAt: true,
      },
    });

    return toMemberGuidePost(record as MemberGuidePostRecord);
  }

  const rows = await prisma.$queryRaw<MemberGuidePostRecord[]>`
    UPDATE "public"."member_guide_posts"
    SET
      "is_published" = ${isPublished},
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING
      "id",
      "type",
      "title",
      "description",
      "embed_url" AS "embedUrl",
      "file_asset_id" AS "fileAssetId",
      "file_url" AS "fileUrl",
      "is_paid" AS "isPaid",
      "price",
      "sort_order" AS "sortOrder",
      "is_published" AS "isPublished",
      "published_at" AS "publishedAt",
      "section",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
  `;

  return rows[0] ? toMemberGuidePost(rows[0]) : null;
}

export async function deleteMemberGuidePost(id: string) {
  if (hasMemberGuidePostWriteDelegate()) {
    await prisma.memberGuidePost.delete({
      where: { id },
    });

    return;
  }

  await prisma.$executeRaw`
    DELETE FROM "public"."member_guide_posts"
    WHERE "id" = ${id}
  `;
}

export async function getMemberGuidePostById(id: string) {
  if (hasMemberGuidePostReadDelegate()) {
    const record = await prisma.memberGuidePost.findUnique({
      where: { id },
      select: {
        createdAt: true,
        description: true,
        embedUrl: true,
        fileAssetId: true,
        fileUrl: true,
        id: true,
        isPaid: true,
        isPublished: true,
        price: true,
        publishedAt: true,
        section: true,
        sortOrder: true,
        title: true,
        type: true,
        updatedAt: true,
      },
    });

    return record ? toMemberGuidePost(record as MemberGuidePostRecord) : null;
  }

  const rows = await prisma.$queryRaw<MemberGuidePostRecord[]>`
    SELECT
      "id",
      "type",
      "title",
      "description",
      "embed_url" AS "embedUrl",
      "file_asset_id" AS "fileAssetId",
      "file_url" AS "fileUrl",
      "is_paid" AS "isPaid",
      "price",
      "sort_order" AS "sortOrder",
      "is_published" AS "isPublished",
      "published_at" AS "publishedAt",
      "section",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "public"."member_guide_posts"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  return rows[0] ? toMemberGuidePost(rows[0]) : null;
}

export async function attachMemberGuideAccess(
  guides: MemberGuidePost[],
  profileId: string,
) {
  const paidGuideIds = guides.filter((guide) => guide.isPaid).map((guide) => guide.id);

  if (!paidGuideIds.length) {
    return guides.map((guide) => ({
      ...guide,
      isUnlocked: !guide.isPaid,
    }));
  }

  const rows = await prisma.memberGuideUnlock.findMany({
    where: {
      guidePostId: {
        in: paidGuideIds,
      },
      profileId,
    },
    select: {
      guidePostId: true,
    },
  });
  const unlockedIds = new Set(rows.map((row) => row.guidePostId));

  return guides.map((guide) => ({
    ...guide,
    isUnlocked: !guide.isPaid || unlockedIds.has(guide.id),
  }));
}
