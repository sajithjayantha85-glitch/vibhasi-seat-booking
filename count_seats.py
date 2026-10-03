import cv2
import numpy as np

img = cv2.imread(r'C:\Users\Sajith\.gemini\antigravity\brain\c93d91b2-c8e5-4f22-8973-7a6c0b1aa901\.user_uploaded\media_1791002013107.jpg')
h, w, _ = img.shape

# Let's crop individual rows along their curve and plot vertical columns
# Row centers at aisle:
rows_y = [
    366, 388, 410, 430, 450, 470, 490, 510, 530, 550,
    570, 590, 610, 630, 650, 670, 690, 710, 730, 750,
    770, 790, 810, 830, 850, 866
]

# We will create an annotated image where each row has a label and each chair has a mark
annotated = img.copy()

# Upper rows (1-9): flared section
# Lower rows (10-26): straight walls down to entrance
print('Processing rows...')
