import mongoose, { Document, Schema } from "mongoose";

export type FeedPostStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "DELETED";

export interface iFeedPostMedia {
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number; // video
}

export interface iFeedLocation {
  geo: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  city?: string;
  zipCode?: string;
  country?: string; // "FR"
}

export interface iFeedMetrics {
  likesCount: number;
  viewsCount: number;
  savesCount: number;
}

export interface iFeedPost extends Document {
  proId: mongoose.Types.ObjectId;
  shopId?: mongoose.Types.ObjectId;

  status: FeedPostStatus;

  media: iFeedPostMedia;
  caption?: string;
  tags: string[];

  serviceIds?: mongoose.Types.ObjectId[];

  location?: iFeedLocation;

  metrics: iFeedMetrics;

  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date | null;
}

const FeedMediaSchema = new Schema<iFeedPostMedia>(
  {
    type: { type: String, enum: ["image", "video"], required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String },
    width: { type: Number },
    height: { type: Number },
    durationSec: { type: Number },
  },
  { _id: false }
);

const FeedLocationSchema = new Schema<iFeedLocation>(
  {
    geo: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
        validate: {
          validator: (v: any) => Array.isArray(v) && v.length === 2,
          message: "geo.coordinates must be [lng, lat]",
        },
      },
    },
    city: { type: String },
    zipCode: { type: String },
    country: { type: String },
  },
  { _id: false }
);

const FeedMetricsSchema = new Schema<iFeedMetrics>(
  {
    likesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    savesCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const feedPostSchema = new Schema<iFeedPost>(
  {
    proId: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: false },

    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "HIDDEN", "DELETED"],
      default: "DRAFT",
      index: true,
    },

    media: { type: FeedMediaSchema, required: true },
    caption: { type: String },
    tags: { type: [String], default: [] },

    serviceIds: { type: [Schema.Types.ObjectId], default: [] },

    location: { type: FeedLocationSchema, required: false },

    metrics: { type: FeedMetricsSchema, default: () => ({}) },

    publishedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// Indexes clés
feedPostSchema.index({ status: 1, publishedAt: -1, _id: -1 });
feedPostSchema.index({ proId: 1, publishedAt: -1 });
feedPostSchema.index({ "location.geo": "2dsphere" });

const FeedPostModel = mongoose.model<iFeedPost>("FeedPost", feedPostSchema);
export default FeedPostModel;
