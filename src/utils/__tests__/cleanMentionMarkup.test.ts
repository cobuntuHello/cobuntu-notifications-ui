import { describe, it, expect } from "vitest";
import { cleanMentionMarkup } from "../cleanMentionMarkup";

describe("cleanMentionMarkup", () => {
  it("strips user mention markup to @usertag", () => {
    expect(cleanMentionMarkup("Hey @[becky](user:becky), thanks!")).toBe("Hey @becky, thanks!");
  });

  it("strips community mention markup to /communitytag", () => {
    expect(cleanMentionMarkup("Check out /[orbis](community:orbis)")).toBe("Check out /orbis");
  });

  it("handles multiple mentions in one string", () => {
    expect(
      cleanMentionMarkup(
        "@[ana](user:ana) and @[carl](user:carl) joined /[desconversados](community:desconversados)"
      )
    ).toBe("@ana and @carl joined /desconversados");
  });

  it("returns empty string unchanged", () => {
    expect(cleanMentionMarkup("")).toBe("");
  });

  it("returns content unchanged when no mention markup is present", () => {
    expect(cleanMentionMarkup("Just regular text here")).toBe("Just regular text here");
  });
});
