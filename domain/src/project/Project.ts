import { pipe } from "fp-ts/lib/function.js";
import * as Codec from "io-ts/lib/Codec.js";
import { fromClassCodec } from "@iots";
import { ProjectOwnerId } from "./ProjectOwnerId";
import { ApiKey } from "./ApiKey";
import { FirebaseUserId } from "./FirebaseUserId";
import { CodecType } from "../iots/CodecType";
import { ProjectSlug } from "./ProjectSlug";
import { ProjectId } from "./ProjectId";

export class Project {
  id;
  slug;
  ownerId;
  readerIds;
  editorIds;
  apiKeys;

  constructor(props: ProjectProps) {
    this.id = props.id;
    this.slug = props.slug;
    this.ownerId = props.ownerId;
    this.readerIds = props.readerIds;
    this.editorIds = props.editorIds;
    this.apiKeys = props.apiKeys;
  }

  hasReadAccess(userId: FirebaseUserId) {
    return (
      this.isOwner(userId) ||
      this.hasEditAccess(userId) ||
      this.editorIds?.some((editorId) => editorId.id === userId.id)
    );
  }

  hasEditAccess(userId: FirebaseUserId) {
    return (
      this.isOwner(userId) ||
      this.readerIds?.some((readerId) => readerId.id === userId.id)
    );
  }

  isOwner(userId: FirebaseUserId) {
    return (
      this.ownerId._tag === "FirebaseUserId" && this.ownerId.id === userId.id
    );
  }

  static propsCodec = (codecType?: CodecType) =>
    pipe(
      Codec.struct({
        id: ProjectId.codec,
        slug: ProjectSlug.codec,
        ownerId: ProjectOwnerId.codec,
      }),
      Codec.intersect(
        Codec.partial({
          readerIds: Codec.array(FirebaseUserId.codec),
          editorIds: Codec.array(FirebaseUserId.codec),
          apiKeys: Codec.record(ApiKey.codec(codecType)),
        })
      )
    );

  static codec = (codecType?: CodecType) =>
    pipe(Project.propsCodec(codecType), Codec.compose(fromClassCodec(Project)));
}

export type ProjectProps = Codec.TypeOf<ReturnType<typeof Project.propsCodec>>;
