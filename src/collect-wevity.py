"""Refresh the verified external notice snapshot (requires requests and beautifulsoup4)."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import time
from urllib.parse import parse_qs, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = "https://www.wevity.com/"
OUTPUT = Path(__file__).resolve().parents[1] / "data/wevity.json"
TODAY = datetime.now(timezone(timedelta(hours=9))).date().isoformat()
session = requests.Session()
session.headers["User-Agent"] = "KNU-Notice/1.0 (public contest and activity metadata)"


def page(params):
    response = session.get(ROOT, params=params, timeout=15, allow_redirects=False)
    if response.is_redirect:
        target=requests.compat.urljoin(response.url,response.headers["Location"])
        if urlparse(target).netloc!="www.wevity.com" or urlparse(target).scheme!="https":
            raise ValueError("Unexpected source domain")
        response=session.get(target,timeout=15,allow_redirects=False)
    response.raise_for_status()
    if response.status_code != 200:
        raise ValueError("Unexpected source response")
    return BeautifulSoup(response.content, "html.parser")


def listing_type(title):
    if re.search(r"공모전\s*준비|교정\s*서비스|기념\s*이벤트", title):
        return None
    if re.search(r"공모|경진대회|콘테스트|아이디어톤|해커톤|챔피언십|챌린지|광고제|Competition|Challenge|문학상|자랑대회", title, re.I):
        return "공모전"
    if re.search(r"서포터즈|봉사|양성과정|교육생|마케터\s*모집|캠페인|책쓰기\s*프로젝트", title):
        return "비교과"
    return None


def read_detail(record_id):
    params = {"c": "find", "s": 1, "gbn": "view", "ix": record_id}
    doc = page(params)
    title = doc.select_one(".tit-area h6.tit")
    fields = {}
    for tag in doc.select("li > span.tit"):
        label = tag.get_text(strip=True)
        fields[label] = tag.parent.get_text(" ", strip=True).removeprefix(label).strip()
    dates = re.findall(r"\d{4}-\d{2}-\d{2}", fields.get("접수기간", ""))
    if not title or len(dates) != 2 or not dates[0] <= TODAY <= dates[1]:
        return None
    kind = listing_type(title.get_text(" ",strip=True))
    if not kind:
        return None
    body = doc.select_one("#viewContents")
    lines = body.get_text("\n",strip=True).splitlines() if body else []
    evidence = ""
    for i,line in enumerate(lines):
        heading = re.match(r"^[\s■●○◆▶▷□※*\-]*(?:지원\s*자격|참가\s*자격|응모\s*자격|모집\s*대상|참가\s*대상|신청\s*대상|응모\s*대상)\s*[:：]?\s*(.*)$",line)
        if heading:
            evidence = heading[1] or (lines[i+1] if i+1<len(lines) else "")
            break
    labels = fields.get("분야","")
    target = fields.get("응모대상","")
    return dict(id="wevity-"+record_id,kind="external",type=kind,source="위비티",
                org=fields.get("주최/주관",""),title=title.get_text(" ",strip=True),
                url=requests.Request("GET",ROOT,params=params).prepare().url,
                start=dates[0],deadline=dates[1],checkedAt=TODAY,docs=[],cond={},
                body="분야 · "+labels+"\n응모대상 · "+target+("\n모집 대상: "+evidence[:220] if evidence else ""),
                snippet="분야 · "+labels+" / 응모대상 · "+target)


def collect():
    rows = {r["id"]:r for r in json.loads(OUTPUT.read_text("utf8")) if r["deadline"]>=TODAY} if OUTPUT.exists() else {}
    seen = set()
    checked = 0
    # Source categories span writing, art, software, science, research and extracurricular activities.
    for category in (27, 22, 3, 19, 20, 1, 23, 89, 10, 2):
        doc = page({"c":"find","s":1,"gub":1,"cidx":category})
        count = 0
        for anchor in doc.select("li .tit > a[href*='gbn=view']"):
            parent = anchor.find_parent("li")
            if parent.select_one(".dday.end"):
                continue
            record_id = parse_qs(urlparse(anchor["href"]).query).get("ix",[""])[0]
            if not record_id.isdecimal() or record_id in seen:
                continue
            seen.add(record_id)
            time.sleep(3)
            row = read_detail(record_id)
            checked += 1
            if row:
                rows[row["id"]]=row
                count += 1
            else:
                rows.pop("wevity-"+record_id,None)
            if count>=4 or len(seen)>=75:
                break
        time.sleep(3)
    if not checked or not any(r["checkedAt"]==TODAY for r in rows.values()):
        raise RuntimeError("No verified open records; keeping previous snapshot")
    tmp=OUTPUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(list(rows.values()),ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    tmp.replace(OUTPUT)
    print({k:sum(r["type"]==k for r in rows.values()) for k in ("공모전","비교과")})


if __name__=="__main__":
    collect()
