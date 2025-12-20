<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'list_group')]
class ListGroup
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $name;

    #[ORM\ManyToMany(targetEntity: User::class)]
    #[ORM\JoinTable(name: 'list_group_user')]
    private Collection $users;

    #[ORM\OneToMany(mappedBy: 'listGroup', targetEntity: ListEntity::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $lists;

    public function __construct()
    {
        $this->users = new ArrayCollection();
        $this->lists = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;

        return $this;
    }

    public function getUsers(): Collection
    {
        return $this->users;
    }

    public function addUser(User $user): self
    {
        if (!$this->users->contains($user)) {
            $this->users->add($user);
        }

        return $this;
    }

    public function removeUser(User $user): self
    {
        $this->users->removeElement($user);

        return $this;
    }

    public function getLists(): Collection
    {
        return $this->lists;
    }

    public function addList(ListEntity $list): self
    {
        if (!$this->lists->contains($list)) {
            $this->lists->add($list);
            $list->setListGroup($this);
        }

        return $this;
    }

    public function removeList(ListEntity $list): self
    {
        if ($this->lists->removeElement($list)) {
            if ($list->getListGroup() === $this) {
                $list->setListGroup(null);
            }
        }

        return $this;
    }
}
