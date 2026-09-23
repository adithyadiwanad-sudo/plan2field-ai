import { ApiError } from "../middleware/errors.js";
export type GeofenceStatus = "VERIFIED" | "OUT_OF_BOUNDS" | "UNKNOWN";
export function geofence(
  project: {
    site_latitude?: number | null;
    site_longitude?: number | null;
    geofence_radius_m?: number | null;
  },
  latitude?: number,
  longitude?: number,
  accuracy?: number,
): GeofenceStatus {
  if (
    latitude == null ||
    longitude == null ||
    accuracy == null ||
    project.site_latitude == null ||
    project.site_longitude == null ||
    project.geofence_radius_m == null
  )
    return "UNKNOWN";
  const rad = (n: number) => (n * Math.PI) / 180;
  const a =
    Math.sin(rad(latitude - project.site_latitude) / 2) ** 2 +
    Math.cos(rad(latitude)) *
      Math.cos(rad(project.site_latitude)) *
      Math.sin(rad(longitude - project.site_longitude) / 2) ** 2;
  const distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  if (distance + accuracy <= project.geofence_radius_m) return "VERIFIED";
  if (distance - accuracy > project.geofence_radius_m) return "OUT_OF_BOUNDS";
  return "UNKNOWN";
}
export function photoType(
  file: Express.Multer.File,
): "image/png" | "image/jpeg" {
  if (file.buffer.length > 5 * 1024 * 1024)
    throw new ApiError(
      413,
      "PHOTO_TOO_LARGE",
      "Each evidence photo must be at most 5 MB.",
    );
  const b = file.buffer;
  if (
    b.length >= 24 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    b.toString("ascii", 12, 16) === "IHDR"
  )
    return "image/png";
  if (b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255)
    return "image/jpeg";
  throw new ApiError(
    400,
    "INVALID_PHOTO",
    "Evidence photos must contain PNG or JPEG image data.",
  );
}
export async function directSuccessors(
  db: any,
  project: string,
  version: string,
  activity: string,
) {
  return (
    await db.query(
      `SELECT a.id AS activity_id,a.external_activity_id,a.description,r.relationship_type,r.lag,r.source_metadata
 FROM activity_relationships r JOIN schedule_activities a ON a.id=r.successor AND a.project_id=r.project_id AND a.schedule_version_id=r.schedule_version_id
 WHERE r.project_id=$1 AND r.schedule_version_id=$2 AND r.predecessor=$3 ORDER BY a.external_activity_id`,
      [project, version, activity],
    )
  ).rows;
}
