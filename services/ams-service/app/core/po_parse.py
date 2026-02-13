"""PO Parsing - Parse purchase orders from various channel formats"""
from __future__ import annotations

from pathlib import Path
from typing import List

from .types import NormalizedPo


def parse_po_file(file_path: Path, channel: str, vendor_code: str) -> List[NormalizedPo]:
    """
    Parse a PO file based on channel.
    Returns list of normalized POs.
    """
    channel_key = channel.strip().lower()
    
    if channel_key == "amazon":
        from ..adapters.amazon_vendor_download import parse_amazon_vendor_download
        return parse_amazon_vendor_download(file_path, vendor_code=vendor_code)
    
    if channel_key == "zepto":
        from ..adapters.zepto_po_csv import parse_zepto_po_csv
        from ..adapters.zepto_po_order_strict_xlsx import parse_zepto_po_order_strict
        if file_path.suffix.lower() == ".csv":
            return parse_zepto_po_csv(file_path, vendor_code=vendor_code)
        return parse_zepto_po_order_strict(file_path, vendor_code=vendor_code)
    
    raise ValueError(f"Unsupported channel parser: {channel_key}")


