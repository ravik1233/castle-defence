"""Bring health and damage down to numbers a player can count.

A militia had 260 health and an archer hit for 26, so a goblin took ten
arrows and nobody could hold any of it in their head. Health and damage are
divided by different amounts on purpose: dividing both by the same factor
keeps the arithmetic but rounds every attacker in the game down to "1", so an
archer, a guardian and an arbalest all hit for the same. Health falls further
than damage, which is what shortens a fight to something countable - three to
eight blows for the rank and file - and leaves damage room to say which
weapon is the heavier one.

Armour is a flat subtraction from a blow, so it moves with damage. Bounty and
threat are currencies rather than health and are left alone.

    python3 scripts/rescale-numbers.py           # rewrite the data
    python3 scripts/rescale-numbers.py --check   # say what it would do
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

#: Health divides by this, damage by that. See the note above for why.
#:
#: Twelve rather than twenty for a blow, because the weakest weapon in the
#: game is the militia's at eleven. Divide by twenty and it rounds to one -
#: but so does the archer's twenty-six, and the archer stops being the better
#: shot. Dividing by roughly the smallest real blow keeps the order intact:
#: militia one, archer two, guardian three, arbalest five.
HP_DIV = 40
DMG_DIV = 12

#: Which fields are health, which are blows, per file.
HEALTH = {'hp'}
BLOW = {'damage', 'armor'}


def scaled(value: int, divisor: int) -> int:
    """At least one: nothing in the game may round away to nothing."""
    return max(1, round(value / divisor))


def rewrite(path: Path, check: bool) -> int:
    text = path.read_text()
    changes = 0

    def sub(match: re.Match[str]) -> str:
        nonlocal changes
        key, value = match.group('key'), int(match.group('value'))
        if key in HEALTH:
            new = scaled(value, HP_DIV)
        elif key in BLOW:
            # Armour of zero stays zero: it means "no armour", not "a little".
            new = 0 if (key == 'armor' and value == 0) else scaled(value, DMG_DIV)
        else:
            return match.group(0)
        if new != value:
            changes += 1
        return f'{key}: {new}'

    """
    Matched anywhere on a line, not just at its start: the attack block is
    written inline - `attack: { damage: 11, rate: 1.1, range: 110 }` - and an
    anchored pattern walked straight past every weapon in the game, rescaling
    health alone and leaving a militia hitting for eleven against a goblin
    with three.

    `upgrade: { hp: 0.12, damage: 0.16 }` carries multipliers rather than
    values, so lines declaring one are skipped outright, and the integer-only
    pattern would not have matched their decimals anyway.
    """
    out = '\n'.join(
        line if 'upgrade:' in line else re.sub(r'(?P<key>\bhp|\bdamage|\barmor): (?P<value>\d+)\b', sub, line)
        for line in text.split('\n')
    )
    if not check:
        path.write_text(out)
    return changes


def main() -> None:
    check = '--check' in sys.argv
    total = 0
    for rel in ('src/data/defenders.ts', 'src/data/enemies.ts', 'src/data/heroes.ts'):
        n = rewrite(ROOT / rel, check)
        total += n
        print(f'{rel}: {n} numbers {"would change" if check else "rescaled"}')
    print(f'{total} in total')


if __name__ == '__main__':
    main()
