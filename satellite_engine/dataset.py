from pathlib import Path

import albumentations as A
import numpy as np
from albumentations.pytorch import ToTensorV2
from PIL import Image
from torch.utils.data import Dataset

from config import SPLITS_ROOT, TILES_ROOT

MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


class SatelliteDataset(Dataset):
    def __init__(self, names: list[str], train: bool = True):
        self.names = names
        self.tf = A.Compose(
            [
                A.HorizontalFlip(p=0.5),
                A.VerticalFlip(p=0.5),
                A.RandomRotate90(p=0.5),
                A.RandomBrightnessContrast(p=0.3),
                A.Normalize(mean=MEAN, std=STD),
                ToTensorV2(),
            ]
            if train
            else [
                A.Normalize(mean=MEAN, std=STD),
                ToTensorV2(),
            ]
        )

    def __len__(self) -> int:
        return len(self.names)

    def __getitem__(self, i: int):
        name = self.names[i]
        image = np.array(Image.open(TILES_ROOT / "images" / name).convert("RGB"))
        mask = np.array(Image.open(TILES_ROOT / "masks" / name), dtype=np.int64)
        z = self.tf(image=image, mask=mask)
        return z["image"], z["mask"].long()


def read_names(split: str) -> list[str]:
    return [x.strip() for x in (SPLITS_ROOT / f"{split}.txt").read_text().splitlines() if x.strip()]
