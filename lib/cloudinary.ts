"use server";

/**
 * Cloudinary Integration Helper
 *
 * Signed upload/destroy via the CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY /
 * CLOUDINARY_API_SECRET env vars.
 */

import crypto from "crypto";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";

function getCredentials() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }
  return { cloudName, apiKey, apiSecret };
}

function sign(paramsToSign: string, apiSecret: string) {
  return crypto.createHash("sha1").update(paramsToSign + apiSecret).digest("hex");
}

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  original_filename: string;
};

async function uploadToCloudinary(file: File, folder: string): Promise<CloudinaryUploadResponse> {
  const { cloudName, apiKey, apiSecret } = getCredentials();

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = sign(paramsToSign, apiSecret);

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const body = new FormData();
  body.append("file", dataUri);
  body.append("api_key", apiKey);
  body.append("timestamp", String(timestamp));
  body.append("signature", signature);
  body.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  return res.json();
}

// Unchanged, still used directly by ProfileForm for avatar uploads — those
// aren't public content assets worth tracking in the shared library or
// forcing alt text onto.
export async function uploadImage(file: File): Promise<string> {
  const data = await uploadToCloudinary(file, "tbj-growth");
  return data.secure_url;
}

export async function destroyImage(publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret } = getCredentials();

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = sign(paramsToSign, apiSecret);

  const body = new FormData();
  body.append("public_id", publicId);
  body.append("api_key", apiKey);
  body.append("timestamp", String(timestamp));
  body.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Cloudinary destroy failed: ${errorText}`);
  }
}

// The Media Library's upload path — distinct from the bare uploadImage()
// above because this one is a real DB mutation (creates a MediaAsset row),
// not just a Cloudinary proxy. Gated here too, in addition to the
// MEDIA_MANAGEMENT check already present in every actions/media.ts caller,
// as defense in depth — matches how every other mutation this session
// enforces authorization at the point of the actual write, not just at the
// page/route level.
export async function uploadAndRegisterMedia(
  file: File,
  opts: { altText: string; folder?: string; title?: string }
) {
  const altText = opts.altText?.trim();
  if (!altText) {
    throw new Error("Alt text is required");
  }

  const session = await requirePermission("MEDIA_MANAGEMENT");
  const folder = opts.folder?.trim() || "Uncategorized";

  const data = await uploadToCloudinary(file, "tbj-growth");

  const asset = await prisma.mediaAsset.create({
    data: {
      publicId: data.public_id,
      url: data.secure_url,
      filename: data.original_filename,
      format: data.format,
      width: data.width,
      height: data.height,
      bytes: data.bytes,
      folder,
      altText,
      title: opts.title?.trim() || data.original_filename,
      uploadedById: session.user.id,
      uploadedByName: session.user.name ?? null,
      uploadedByEmail: session.user.email ?? null,
    },
  });

  await logAudit({
    action: "create",
    category: "Media",
    entityType: "MediaAsset",
    entityId: asset.id,
    entityLabel: asset.title,
    after: { url: asset.url, folder: asset.folder, altText: asset.altText, filename: asset.filename, format: asset.format, width: asset.width, height: asset.height, bytes: asset.bytes },
  });

  return { asset, url: asset.url };
}

export { uploadToCloudinary };
