git log --graph --oneline -U0 --submodule $1..HEAD | grep -E '^[*| /\]+([0-9a-f]+ |Submodule |> |$)' >> changelog_$2.txt
