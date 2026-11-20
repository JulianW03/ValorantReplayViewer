import * as ResEdit from "resedit"
import path from "path";
import fs from "fs"

const targetExecutable = process.argv[2]

if (!targetExecutable) {
    console.error("No target executable argument provided")
    process.exit(1)
}

const ICO_PATH = path.join(import.meta.dirname, "icon.ico")

const exe = ResEdit.NtExecutable.from(fs.readFileSync(targetExecutable))
const res = ResEdit.NtExecutableResource.from(exe);
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];

const lang = 1033;
const codepage = 1200;
vi.setStringValues({ lang, codepage }, {
    FileDescription: "Valorant Replay Viewer",
    ProductName: "Valorant Replay Viewer"
});
vi.outputToResourceEntries(res.entries);

console.log(`Using icon file at ${ICO_PATH}`)
const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ICO_PATH));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    groups[0]?.id ?? 1,
    groups[0]?.lang ?? lang,
    iconFile.icons.map((item) => item.data)
);

res.outputResource(exe);

const oldSubsystem = exe.newHeader.optionalHeader.subsystem;
/**
 * @see https://learn.microsoft.com/en-us/dotnet/api/microsoft.visualstudio.vcprojectengine.subsystemoption
 * */
exe.newHeader.optionalHeader.subsystem = 3;
fs.writeFileSync(targetExecutable, Buffer.from(exe.generate()));