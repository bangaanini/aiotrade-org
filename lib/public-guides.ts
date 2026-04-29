import "server-only";

import type { PublicGuideAsset, PublicGuidePdfPost } from "@/lib/public-guide-types";
import { normalizePublicGuideFileUrl } from "@/lib/public-guide-utils";
import { prisma } from "@/lib/prisma";

type PublicGuideAssetRecord = {
  bytes: number | null;
  createdAt: Date;
  format: string | null;
  id: string;
  label: string;
  originalFilename: string | null;
  publicId: string;
  secureUrl: string;
};

type PublicGuidePdfPostRecord = {
  createdAt: Date;
  description: string;
  fileAssetId: string | null;
  fileUrl: string;
  id: string;
  isPublished: boolean;
  publishedAt: Date;
  sortOrder: number;
  title: string;
  updatedAt: Date;
};

type SavePublicGuideAssetInput = {
  bytes?: number | null;
  format?: string | null;
  label: string;
  originalFilename?: string | null;
  publicId: string;
  secureUrl: string;
};

type SavePublicGuidePdfPostInput = {
  description: string;
  fileAssetId?: string | null;
  fileUrl?: string | null;
  id?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  sortOrder: number;
  title: string;
};

function hasPublicGuideAssetDelegate() {
  return (
    "publicGuideAsset" in prisma &&
    typeof prisma.publicGuideAsset?.findMany === "function" &&
    typeof prisma.publicGuideAsset?.upsert === "function"
  );
}

function hasPublicGuidePdfReadDelegate() {
  return (
    "publicGuidePdfPost" in prisma &&
    typeof prisma.publicGuidePdfPost?.findMany === "function" &&
    typeof prisma.publicGuidePdfPost?.findUnique === "function"
  );
}

function hasPublicGuidePdfWriteDelegate() {
  return (
    "publicGuidePdfPost" in prisma &&
    typeof prisma.publicGuidePdfPost?.create === "function" &&
    typeof prisma.publicGuidePdfPost?.update === "function" &&
    typeof prisma.publicGuidePdfPost?.delete === "function"
  );
}

function toDateOrNow(value: string | null | undefined) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

function toPublicGuideAsset(asset: PublicGuideAssetRecord): PublicGuideAsset {
  return {
    bytes: asset.bytes,
    createdAt: asset.createdAt.toISOString(),
    format: asset.format,
    id: asset.id,
    label: asset.label,
    originalFilename: asset.originalFilename,
    publicId: asset.publicId,
    secureUrl: asset.secureUrl,
  };
}

function toPublicGuidePdfPost(post: PublicGuidePdfPostRecord): PublicGuidePdfPost {
  return {
    createdAt: post.createdAt.toISOString(),
    description: post.description,
    fileAssetId: post.fileAssetId,
    fileUrl: post.fileUrl,
    id: post.id,
    isPublished: post.isPublished,
    publishedAt: post.publishedAt.toISOString(),
    sortOrder: post.sortOrder,
    title: post.title,
    updatedAt: post.updatedAt.toISOString(),
  };
}

export async function getPublicGuideAssets() {
  const tables = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public.public_guide_assets')::text AS "tableName"
  `;

  if (!tables[0]?.tableName) {
    return [] as PublicGuideAsset[];
  }

  const records = hasPublicGuideAssetDelegate()
    ? await prisma.publicGuideAsset.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          bytes: true,
          createdAt: true,
          format: true,
          id: true,
          label: true,
          originalFilename: true,
          publicId: true,
          secureUrl: true,
        },
      })
    : await prisma.$queryRaw<PublicGuideAssetRecord[]>`
        SELECT
          "id",
          "label",
          "public_id" AS "publicId",
          "secure_url" AS "secureUrl",
          "original_filename" AS "originalFilename",
          "bytes",
          "format",
          "created_at" AS "createdAt"
        FROM "public"."public_guide_assets"
        ORDER BY "created_at" DESC
      `;

  return records.map(toPublicGuideAsset);
}

export async function savePublicGuideAsset(input: SavePublicGuideAssetInput) {
  if (hasPublicGuideAssetDelegate()) {
    const asset = await prisma.publicGuideAsset.upsert({
      where: { publicId: input.publicId },
      create: {
        bytes: input.bytes ?? null,
        format: input.format ?? null,
        label: input.label,
        originalFilename: input.originalFilename ?? null,
        publicId: input.publicId,
        secureUrl: input.secureUrl,
      },
      update: {
        bytes: input.bytes ?? null,
        format: input.format ?? null,
        label: input.label,
        originalFilename: input.originalFilename ?? null,
        secureUrl: input.secureUrl,
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
      },
    });

    return toPublicGuideAsset(asset);
  }

  const rows = await prisma.$queryRaw<PublicGuideAssetRecord[]>`
    INSERT INTO "public"."public_guide_assets" (
      "label",
      "public_id",
      "secure_url",
      "original_filename",
      "bytes",
      "format"
    )
    VALUES (
      ${input.label},
      ${input.publicId},
      ${input.secureUrl},
      ${input.originalFilename ?? null},
      ${input.bytes ?? null},
      ${input.format ?? null}
    )
    ON CONFLICT ("public_id")
    DO UPDATE SET
      "label" = EXCLUDED."label",
      "secure_url" = EXCLUDED."secure_url",
      "original_filename" = EXCLUDED."original_filename",
      "bytes" = EXCLUDED."bytes",
      "format" = EXCLUDED."format",
      "updated_at" = CURRENT_TIMESTAMP
    RETURNING
      "id",
      "label",
      "public_id" AS "publicId",
      "secure_url" AS "secureUrl",
      "original_filename" AS "originalFilename",
      "bytes",
      "format",
      "created_at" AS "createdAt"
  `;

  return toPublicGuideAsset(rows[0]);
}

export async function getAdminPublicGuidePdfPosts() {
  const tables = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public.public_guide_pdf_posts')::text AS "tableName"
  `;

  if (!tables[0]?.tableName) {
    return [] as PublicGuidePdfPost[];
  }

  const records = hasPublicGuidePdfReadDelegate()
    ? await prisma.publicGuidePdfPost.findMany({
        orderBy: [{ updatedAt: "desc" }],
        select: {
          createdAt: true,
          description: true,
          fileAssetId: true,
          fileUrl: true,
          id: true,
          isPublished: true,
          publishedAt: true,
          sortOrder: true,
          title: true,
          updatedAt: true,
        },
      })
    : await prisma.$queryRaw<PublicGuidePdfPostRecord[]>`
        SELECT
          "id",
          "title",
          "description",
          "file_asset_id" AS "fileAssetId",
          "file_url" AS "fileUrl",
          "sort_order" AS "sortOrder",
          "is_published" AS "isPublished",
          "published_at" AS "publishedAt",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
        FROM "public"."public_guide_pdf_posts"
        ORDER BY "updated_at" DESC
      `;

  return records.map(toPublicGuidePdfPost);
}

export async function getPublishedPublicGuidePdfPosts(limit?: number) {
  const tables = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public.public_guide_pdf_posts')::text AS "tableName"
  `;

  if (!tables[0]?.tableName) {
    return [] as PublicGuidePdfPost[];
  }

  const take = typeof limit === "number" && limit > 0 ? Math.floor(limit) : null;
  const records = hasPublicGuidePdfReadDelegate()
    ? await prisma.publicGuidePdfPost.findMany({
        where: { isPublished: true },
        take: take ?? undefined,
        orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        select: {
          createdAt: true,
          description: true,
          fileAssetId: true,
          fileUrl: true,
          id: true,
          isPublished: true,
          publishedAt: true,
          sortOrder: true,
          title: true,
          updatedAt: true,
        },
      })
    : take
      ? await prisma.$queryRaw<PublicGuidePdfPostRecord[]>`
          SELECT
            "id",
            "title",
            "description",
            "file_asset_id" AS "fileAssetId",
            "file_url" AS "fileUrl",
            "sort_order" AS "sortOrder",
            "is_published" AS "isPublished",
            "published_at" AS "publishedAt",
            "created_at" AS "createdAt",
            "updated_at" AS "updatedAt"
          FROM "public"."public_guide_pdf_posts"
          WHERE "is_published" = true
          ORDER BY "sort_order" ASC, "published_at" DESC, "created_at" DESC
          LIMIT ${take}
        `
      : await prisma.$queryRaw<PublicGuidePdfPostRecord[]>`
          SELECT
            "id",
            "title",
            "description",
            "file_asset_id" AS "fileAssetId",
            "file_url" AS "fileUrl",
            "sort_order" AS "sortOrder",
            "is_published" AS "isPublished",
            "published_at" AS "publishedAt",
            "created_at" AS "createdAt",
            "updated_at" AS "updatedAt"
          FROM "public"."public_guide_pdf_posts"
          WHERE "is_published" = true
          ORDER BY "sort_order" ASC, "published_at" DESC, "created_at" DESC
        `;

  return records.map(toPublicGuidePdfPost);
}

export async function getPublishedPublicGuidePdfPostById(id: string) {
  const normalizedId = id.trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedId)) {
    return null;
  }

  const tables = await prisma.$queryRaw<Array<{ tableName: string | null }>>`
    SELECT to_regclass('public.public_guide_pdf_posts')::text AS "tableName"
  `;

  if (!tables[0]?.tableName) {
    return null;
  }

  const record = hasPublicGuidePdfReadDelegate()
    ? await prisma.publicGuidePdfPost.findFirst({
        where: {
          id: normalizedId,
          isPublished: true,
        },
        select: {
          createdAt: true,
          description: true,
          fileAssetId: true,
          fileUrl: true,
          id: true,
          isPublished: true,
          publishedAt: true,
          sortOrder: true,
          title: true,
          updatedAt: true,
        },
      })
    : (
        await prisma.$queryRaw<PublicGuidePdfPostRecord[]>`
          SELECT
            "id",
            "title",
            "description",
            "file_asset_id" AS "fileAssetId",
            "file_url" AS "fileUrl",
            "sort_order" AS "sortOrder",
            "is_published" AS "isPublished",
            "published_at" AS "publishedAt",
            "created_at" AS "createdAt",
            "updated_at" AS "updatedAt"
          FROM "public"."public_guide_pdf_posts"
          WHERE "id" = ${normalizedId}::uuid
            AND "is_published" = true
          LIMIT 1
        `
      )[0] ?? null;

  return record ? toPublicGuidePdfPost(record as PublicGuidePdfPostRecord) : null;
}

export async function savePublicGuidePdfPost(input: SavePublicGuidePdfPostInput) {
  const normalizedFileUrl = normalizePublicGuideFileUrl(input.fileUrl);
  const normalizedFileAssetId = input.fileAssetId?.trim() || null;

  if (!normalizedFileUrl || !normalizedFileAssetId) {
    throw new Error("PDF publik membutuhkan asset dan URL file yang valid.");
  }

  const payload = {
    description: input.description.trim(),
    fileAssetId: normalizedFileAssetId,
    fileUrl: normalizedFileUrl,
    isPublished: input.isPublished,
    publishedAt: toDateOrNow(input.publishedAt),
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
    title: input.title.trim(),
  };

  if (hasPublicGuidePdfWriteDelegate()) {
    const record = input.id
      ? await prisma.publicGuidePdfPost.update({
          where: { id: input.id },
          data: payload,
          select: {
            createdAt: true,
            description: true,
            fileAssetId: true,
            fileUrl: true,
            id: true,
            isPublished: true,
            publishedAt: true,
            sortOrder: true,
            title: true,
            updatedAt: true,
          },
        })
      : await prisma.publicGuidePdfPost.create({
          data: payload,
          select: {
            createdAt: true,
            description: true,
            fileAssetId: true,
            fileUrl: true,
            id: true,
            isPublished: true,
            publishedAt: true,
            sortOrder: true,
            title: true,
            updatedAt: true,
          },
        });

    return toPublicGuidePdfPost(record);
  }

  const rows = input.id
    ? await prisma.$queryRaw<PublicGuidePdfPostRecord[]>`
        UPDATE "public"."public_guide_pdf_posts"
        SET
          "title" = ${payload.title},
          "description" = ${payload.description},
          "file_asset_id" = ${payload.fileAssetId},
          "file_url" = ${payload.fileUrl},
          "sort_order" = ${payload.sortOrder},
          "is_published" = ${payload.isPublished},
          "published_at" = ${payload.publishedAt},
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.id}
        RETURNING
          "id",
          "title",
          "description",
          "file_asset_id" AS "fileAssetId",
          "file_url" AS "fileUrl",
          "sort_order" AS "sortOrder",
          "is_published" AS "isPublished",
          "published_at" AS "publishedAt",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
      `
    : await prisma.$queryRaw<PublicGuidePdfPostRecord[]>`
        INSERT INTO "public"."public_guide_pdf_posts" (
          "title",
          "description",
          "file_asset_id",
          "file_url",
          "sort_order",
          "is_published",
          "published_at"
        )
        VALUES (
          ${payload.title},
          ${payload.description},
          ${payload.fileAssetId},
          ${payload.fileUrl},
          ${payload.sortOrder},
          ${payload.isPublished},
          ${payload.publishedAt}
        )
        RETURNING
          "id",
          "title",
          "description",
          "file_asset_id" AS "fileAssetId",
          "file_url" AS "fileUrl",
          "sort_order" AS "sortOrder",
          "is_published" AS "isPublished",
          "published_at" AS "publishedAt",
          "created_at" AS "createdAt",
          "updated_at" AS "updatedAt"
      `;

  return toPublicGuidePdfPost(rows[0]);
}

export async function setPublicGuidePdfPublishedState(id: string, isPublished: boolean) {
  if (hasPublicGuidePdfWriteDelegate()) {
    const record = await prisma.publicGuidePdfPost.update({
      where: { id },
      data: { isPublished },
      select: {
        createdAt: true,
        description: true,
        fileAssetId: true,
        fileUrl: true,
        id: true,
        isPublished: true,
        publishedAt: true,
        sortOrder: true,
        title: true,
        updatedAt: true,
      },
    });

    return toPublicGuidePdfPost(record);
  }

  const rows = await prisma.$queryRaw<PublicGuidePdfPostRecord[]>`
    UPDATE "public"."public_guide_pdf_posts"
    SET
      "is_published" = ${isPublished},
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING
      "id",
      "title",
      "description",
      "file_asset_id" AS "fileAssetId",
      "file_url" AS "fileUrl",
      "sort_order" AS "sortOrder",
      "is_published" AS "isPublished",
      "published_at" AS "publishedAt",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
  `;

  if (!rows[0]) {
    throw new Error("PDF publik tidak ditemukan.");
  }

  return toPublicGuidePdfPost(rows[0]);
}

export async function deletePublicGuidePdfPost(id: string) {
  if (hasPublicGuidePdfWriteDelegate()) {
    await prisma.publicGuidePdfPost.delete({ where: { id } });
    return;
  }

  await prisma.$executeRaw`
    DELETE FROM "public"."public_guide_pdf_posts"
    WHERE "id" = ${id}
  `;
}
