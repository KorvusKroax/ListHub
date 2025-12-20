<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'item')]
class Item
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $name;

    #[ORM\Column(type: 'boolean')]
    private bool $isChecked = false;

    #[ORM\ManyToOne(targetEntity: ListEntity::class, inversedBy: 'items')]
    #[ORM\JoinColumn(nullable: false)]
    private ?ListEntity $list = null;

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

    public function isChecked(): bool
    {
        return $this->isChecked;
    }

    public function setIsChecked(bool $isChecked): self
    {
        $this->isChecked = $isChecked;

        return $this;
    }

    public function getList(): ?ListEntity
    {
        return $this->list;
    }

    public function setList(?ListEntity $list): self
    {
        $this->list = $list;

        return $this;
    }
}
