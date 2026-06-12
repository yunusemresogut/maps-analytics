# Proje Geliştirme Görevleri

## Genel Bilgi

* Mevcut projeyi incele ve mevcut mimariyi koruyarak geliştirmeleri yap.
* Şu an herhangi bir backend entegrasyonu yapılmayacak.
* Yakın zamanda Supabase kullanılacağı için veri yapıları buna uygun tasarlansın.
* Şimdilik tüm veriler statik (mock/demo data) olarak çalışsın.
* Kod yapısı ileride Supabase entegrasyonu yapılabilecek şekilde modüler olsun.

---

# Kimlik Doğrulama

## Login

* Uygulama açıldığında ilk olarak Login ekranı gösterilsin.
* Register (Kayıt Ol) ekranı olmayacak.
* Kullanıcı hesapları sadece admin tarafından oluşturulacak.
* Demo amaçlı statik kullanıcı listesi kullanılabilir.

## Kullanıcı Tipleri

İki ayrı giriş yapısı olacak:

### Admin Paneli

* Sadece admin kullanıcıları giriş yapabilir.
* Yönetim işlemleri burada yapılır.

### Kullanıcı Paneli

* Normal kullanıcıların kullandığı panel.
* Yetkilerine göre işlem yapabilir.

---

# Proje Durumları

Her proje veya pin için aşağıdaki durumlar desteklenecek:

* Proje
* İhale
* Şantiye
* Açılış
* Hakediş
* Fatura
* Yakında Açılıyor

Not:

* Hakediş ve Fatura modüllerinin şimdilik tam geliştirilmesine gerek yok.
* Veri modeli ve altyapısı hazır olsun.

---

# Tarih Bazlı Uyarılar

## Açılış Tarihi

* Her proje için Açılış Tarihi alanı bulunacak.
* Açılış tarihi geçtiğinde:

  * Kaç gün geçtiği hesaplanacak.
  * Bildirim sistemi için altyapı hazırlanacak.
  * Şimdilik bildirimler pasif olabilir.

## Yakında Açılıyor

* Açılışa 1 ay veya daha az kaldığında proje kırmızı renkle vurgulansın.
* Bildirim sistemi için altyapı hazırlansın.
* Şimdilik demo çalışması yeterlidir.

---

# Dosya Yönetimi

## Dosya Yükleme

Aşağıdaki dosya türleri desteklenecek:

* PDF
* DWG
* XLSX
* CSV
* DOC
* DOCX
* PNG
* JPG
* MP4

Şimdilik gerçek upload yerine mock veri kullanılabilir.

## Excel Import

İhale ve Proje kayıtlarında Excel Import özelliği olacak.

* Excel dosyasından veri aktarımı yapılabilecek.
* İhale modülünde ayrıca kullanıcıya:

  * "Bunu sipariş et" şeklinde bir uyarı mekanizması için altyapı hazırlansın.
* Şimdilik demo çalışması yeterlidir.

---

# Form Alanları

Mevcut forma aşağıdaki alanlar eklensin:

* Kabul Tarihi
* Yüklenici Firma
* Şantiye Şefi

---

# Kayıt Geçmişi (Audit Log)

## Notlar

* Eklenen notlarda:

  * Kim ekledi
  * Ekleme tarihi

bilgileri gösterilsin.

## Pin Bilgileri

Her pin için:

* Oluşturan kişi
* Oluşturulma tarihi
* Son düzenleyen kişi
* Son düzenlenme tarihi

bilgileri tutulacak ve görüntülenecek.

---

# Bölge Yönetimi

## Bölge Oluşturma

Admin;

* Bölge oluşturabilir.
* Bölge düzenleyebilir.
* Bölge silebilir.

Bir bölge;

* Birden fazla şehirden oluşabilir.
* Şehirler ekle/çıkar mantığıyla yönetilebilir.
* Mümkünse sürükle-bırak desteği düşünülebilir.

## Harita Filtreleme

Harita üzerinde:

* Her bölge için ayrı göster/gizle switch'i olsun.
* Tüm bölgeleri göster seçeneği olsun.
* Tüm bölgeleri gizle seçeneği olsun.
* Genel bir "Bölgeleri Göster/Gizle" butonu bulunsun.

---

# Rol ve Yetki Sistemi

Admin panelinde rol bazlı yetkilendirme olacak.

Her kullanıcı için aşağıdaki izinler ayrı ayrı tanımlanabilecek:

* Görüntüleme
* Ekleme
* Düzenleme
* Silme

Her kullanıcı tüm işlemleri yapmak zorunda değildir.

---

# Admin Paneli

* Admin paneline sadece admin hesapları giriş yapabilir.
* Kullanıcı yönetimi burada yapılacaktır.
* Roller ve yetkiler burada yönetilecektir.

---

# Dashboard

İleride kullanılmak üzere analiz ve grafiksel bir dashboard tasarlanacak.

Şimdilik sadece altyapı ve placeholder ekranı oluşturulabilir.

İleride düşünülebilecek örnek metrikler:

* Bölgelere göre proje sayısı
* Durumlara göre dağılım
* Yaklaşan açılışlar
* Geciken açılışlar
* Kullanıcı aktiviteleri
* Son eklenen projeler

---

# Teknik Beklentiler

* Mevcut projeyi analiz ederek geliştirmeleri entegre et.
* Mevcut UI tasarımını bozma.
* Kodları modüler yaz.
* İleride Supabase'e kolay bağlanabilecek veri modelleri oluştur.
* Şimdilik tüm işlemler mock/static data ile çalışsın.
* Gelecekte backend eklendiğinde minimum değişiklik gerektirecek bir yapı kur.
