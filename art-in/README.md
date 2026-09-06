# art-in

Drop raw painted art here, then run `npm run art:import`.

Nothing in this folder is committed - see `.gitignore`. Raw generator output is
5-6 MB a file and belongs nowhere near git history. The importer writes the
result to `public/assets/painted/`, a couple of hundred KB apiece, and *that*
is what ships.

## Naming

Name each file after the texture key it replaces:

    art-in/unit.militia.full.png     whole painted unit
    art-in/unit.militia.attack.png   optional second pose, used mid-swing
    art-in/unit.militia.parts.png    parts sheet: head, arms, torso, legs, weapon
    art-in/build.ballista.png        a building
    art-in/bg.fields.png             a battlefield backdrop

## From the shared Drive folder

    node scripts/fetch-drive-art.mjs   # -> art-in/raw/, duplicates removed

The folder has to be shared as "Anyone with the link - Viewer", or Drive hands
back its sign-in page instead of the image. Files arrive under their Drive id
because Gemini's own filenames say nothing about what is in them; naming them
is a separate pass.
