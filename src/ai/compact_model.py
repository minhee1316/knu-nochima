"""Build the browser retrieval weights from the pinned Model2Vec tokenizer and safetensors."""
import argparse
import base64
import json
import re
import struct
from pathlib import Path

import numpy as np

REVISION = "73908c3438cf03b6a01bcb9611d62b23d0726f08"
LATIN_WORDS = set("ai sw it ux ui app ml python code coding design career startup internship job rent housing fee money funding tuition scholarship english language exchange global festival music hackathon tech data research art science software engineer business marketing cloud volunteer team project interview resume portfolio kstartup knu kosaf stem lab".split())


def build(folder):
    tokenizer = json.loads((folder / "tokenizer.json").read_text(encoding="utf-8"))
    vocab = tokenizer["model"]["vocab"]
    ids = []
    for idx, (token, _) in enumerate(vocab):
        word = token.lstrip("▁").lower()
        if (re.fullmatch(r"[가-힣]+", word) or word in LATIN_WORDS or
                re.fullmatch(r"[a-z0-9]", word) or token == "▁"):
            ids.append(idx)
    with (folder / "model.safetensors").open("rb") as f:
        (size,) = struct.unpack("<Q", f.read(8))
        meta = json.loads(f.read(size))["embeddings"]
    assert meta["dtype"] == "F32" and meta["shape"] == [len(vocab), 256]
    weights = np.memmap(folder / "model.safetensors", mode="r", dtype="<f4",
                        offset=8+size+meta["data_offsets"][0], shape=tuple(meta["shape"]))[ids]
    # Keep the strongest 80 directions for this vocabulary, then quantize per token.
    _, axes = np.linalg.eigh(weights.T @ weights)
    reduced = weights @ axes[:, -80:]
    scales = np.maximum(np.max(np.abs(reduced), axis=1), 1e-12) / 127
    codes = np.rint(reduced / scales[:, None]).clip(-127, 127).astype("i1")
    b64 = lambda buf: base64.b64encode(buf.tobytes()).decode("ascii")
    return dict(source="minishlab/potion-multilingual-128M", revision=REVISION, dim=codes.shape[1],
                tokens=[vocab[i][0] for i in ids], scores=[round(vocab[i][1], 3) for i in ids],
                scales=b64(scales.astype("<f4")), vectors=b64(codes),
                license=Path(__file__).with_name("MODEL-LICENSE.txt").read_text(encoding="utf-8"))


if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("model_directory", type=Path, help="Pinned repository tokenizer.json and model.safetensors")
    model = build(args.parse_args().model_directory)
    Path(__file__).with_name("gom-ko.json").write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
