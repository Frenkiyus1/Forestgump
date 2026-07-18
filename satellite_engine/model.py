import torch
from transformers import SegformerForSemanticSegmentation

from config import MODEL_NAME, NUM_CLASSES


def build_model() -> SegformerForSemanticSegmentation:
    return SegformerForSemanticSegmentation.from_pretrained(
        MODEL_NAME,
        num_labels=NUM_CLASSES,
        id2label={0: "background", 1: "target"},
        label2id={"background": 0, "target": 1},
        ignore_mismatched_sizes=True,
    )


def load_checkpoint(checkpoint_path: str, device: torch.device) -> SegformerForSemanticSegmentation:
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    model = SegformerForSemanticSegmentation.from_pretrained(
        ckpt["model_name"],
        num_labels=ckpt["num_classes"],
        id2label={0: "background", 1: "target"},
        label2id={"background": 0, "target": 1},
        ignore_mismatched_sizes=True,
    )
    model.load_state_dict(ckpt["state_dict"])
    model.to(device)
    model.eval()
    return model
