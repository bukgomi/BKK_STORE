import { describe, it, expect } from "vitest";
import {
  parseDump, unescapeSql, bucketOf, parentUid, splitPipe, splitComma, optionTypeOf,
  stripHtml, extractImgSrcs, extractYoutubeUrls, normalizeImageRef, isSkinImage, slugFor, normalizeBrand,
} from "../../scripts/migrate/technote/lib";

const SAMPLE = `
# BACKUP TABLE[1] : a_tn4_shop1_list
create table a_tn4_shop1_list (
     no int(11) auto_increment,
     gs_name varchar(255),
     PRIMARY KEY (no)
);
#TNT_QUERY_DELIMITER#
# INSERT ---
insert into a_tn4_shop1_list set
no='1',
gs_name='TPIAA 털스푼(금색)',
gs_txt_body='<img src=\\"./data/tntshop1/img_body/1/1_abc.jpg\\" border=\\"0\\">',
gs_price='5000';
#TNT_QUERY_DELIMITER#
insert into a_tn4_shop1_opt set
no='1', gsj_parent='1', gsj_opt='금-5g|금-7g|', gsj_price='0|1000|';
#TNT_QUERY_DELIMITER#
`;

describe("technote parseDump", () => {
  it("insert 구문을 테이블별 행으로 파싱하고 이스케이프를 해제", () => {
    const { tables } = parseDump(SAMPLE);
    expect(tables.a_tn4_shop1_list).toHaveLength(1);
    const p = tables.a_tn4_shop1_list[0];
    expect(p.no).toBe("1");
    expect(p.gs_name).toBe("TPIAA 털스푼(금색)");
    expect(p.gs_txt_body).toContain('src="./data/tntshop1/img_body/1/1_abc.jpg"');
    expect(tables.a_tn4_shop1_opt[0].gsj_parent).toBe("1");
  });

  it("unescapeSql", () => {
    expect(unescapeSql("a\\'b\\\\c\\nd")).toBe("a'b\\c\nd");
  });
});

describe("technote helpers", () => {
  it("이미지 버킷 = floor(no/100)+1", () => {
    expect(bucketOf(1)).toBe(1);
    expect(bucketOf(96)).toBe(1);
    expect(bucketOf(100)).toBe(2);
    expect(bucketOf(199)).toBe(2);
    expect(bucketOf(201)).toBe(3);
  });

  it("분류 uid 계층", () => {
    expect(parentUid("11")).toBeNull();
    expect(parentUid("1111")).toBe("11");
    expect(parentUid("131211")).toBe("1312");
  });

  it("파이프/쉼표 목록", () => {
    expect(splitPipe("a|b||")).toEqual(["a", "b"]);
    expect(splitPipe("a||b")).toEqual(["a", "", "b"]);
    expect(splitPipe("금-5g|금-7g")).toEqual(["금-5g", "금-7g"]);
    expect(splitComma(",19,21,")).toEqual(["19", "21"]);
  });

  it("옵션 타입 추론", () => {
    expect(optionTypeOf("색상")).toBe("color");
    expect(optionTypeOf("색상/무게")).toBe("color");
    expect(optionTypeOf("사이즈")).toBe("size");
    expect(optionTypeOf("호수")).toBe("size");
    expect(optionTypeOf("OZ")).toBe("weight");
    expect(optionTypeOf("고리수량")).toBe("option");
  });

  it("HTML → 텍스트 / 이미지 / 유튜브 추출", () => {
    const html = `<p align="center"><img src="./data/tntshop1/img_body/1/a.jpg"><br>설명&nbsp;텍스트</p><iframe src="https://www.youtube.com/embed/xyz"></iframe><script>x()</script>`;
    expect(stripHtml(html)).toBe("설명 텍스트");
    expect(extractImgSrcs(html)).toEqual(["./data/tntshop1/img_body/1/a.jpg"]);
    expect(extractYoutubeUrls(html)).toEqual(["https://www.youtube.com/embed/xyz"]);
  });

  it("이미지 참조 정규화", () => {
    expect(normalizeImageRef("./data/tntshop1/img_body/1/a.jpg")).toBe("img_body/1/a.jpg");
    expect(normalizeImageRef("http://topcasting.co.kr/data/tntshop1/img_big/2/197_gs_img_dae.jpg")).toBe("img_big/2/197_gs_img_dae.jpg");
    expect(normalizeImageRef("1_gs_img_dae.jpg", { folder: "img_big", bucket: 1 })).toBe("img_big/1/1_gs_img_dae.jpg");
    expect(normalizeImageRef("./data/temp/its_editor_temp_file_dir/9a24_cmyk.jpg")).toBe("data/temp/its_editor_temp_file_dir/9a24_cmyk.jpg");
    expect(normalizeImageRef("https://other.site/x.jpg")).toBeNull();
    expect(normalizeImageRef("")).toBeNull();
  });

  it("스킨 장식 이미지 판별", () => {
    expect(isSkinImage("./img/board/button/zoom.gif")).toBe(true);
    expect(isSkinImage("img/character/animal30.gif")).toBe(true);
    expect(isSkinImage("./data/tntshop1/img_body/1/a.jpg")).toBe(false);
  });

  it("slug 는 표에서 찾고 중복이면 접미사", () => {
    const taken = new Set<string>();
    expect(slugFor("하드베이트", "11", taken)).toBe("hard-bait");
    expect(slugFor("지그헤드", "1313", taken)).toBe("jig-head");
    expect(slugFor("지그헤드", "2213", taken)).toBe("jig-head-2");
    expect(slugFor("없는분류", "9999", taken)).toBe("c9999");
  });

  it("브랜드 표기 통일", () => {
    expect(normalizeBrand("탑케스팅")).toBe("탑캐스팅(TPIAA)");
    expect(normalizeBrand("탑캐스팅(TPIAA)")).toBe("탑캐스팅(TPIAA)");
    expect(normalizeBrand("")).toBeNull();
    expect(normalizeBrand("다른브랜드")).toBe("다른브랜드");
  });
});
