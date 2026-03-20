GitHub will blocks push for commits containing my personal email:

```sh
git config user.email "PierreFritsch@users.noreply.github.com"
```

Reset author if this got forgotten: 

```sh
git commit --amend --no-edit --reset-author
```